-- ============================================================================
-- AI広報 — RLS, helper functions, triggers, storage
-- ============================================================================

-- ------------------------------------------------------------ helpers -----
create or replace function public.is_org_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.org_id = target and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target uuid, roles member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.org_id = target and m.user_id = auth.uid() and m.role = any(roles)
  );
$$;

create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from memberships where user_id = auth.uid();
$$;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, member_role[]) to authenticated;
grant execute on function public.my_org_ids() to authenticated;

-- ---------------------------------------------- profile bootstrap ---------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------- generic org-scoped RLS policies ---
-- Every table carrying an org_id is readable/writable by members of that org.
do $$
declare
  t record;
begin
  for t in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'org_id'
      and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.tbl);
    execute format('drop policy if exists org_read on public.%I', t.tbl);
    execute format('drop policy if exists org_write on public.%I', t.tbl);
    execute format(
      'create policy org_read on public.%I for select to authenticated
         using (org_id is not null and public.is_org_member(org_id))', t.tbl);
    execute format(
      'create policy org_write on public.%I for all to authenticated
         using (org_id is not null and public.is_org_member(org_id))
         with check (org_id is not null and public.is_org_member(org_id))', t.tbl);
  end loop;
end $$;

-- ------------------------------------------------------ special tables ----
alter table organizations enable row level security;
drop policy if exists org_self_read on organizations;
create policy org_self_read on organizations for select to authenticated
  using (public.is_org_member(id));
drop policy if exists org_self_update on organizations;
create policy org_self_update on organizations for update to authenticated
  using (public.has_org_role(id, array['owner','admin']::member_role[]))
  with check (public.has_org_role(id, array['owner','admin']::member_role[]));
drop policy if exists org_insert on organizations;
create policy org_insert on organizations for insert to authenticated with check (true);

alter table profiles enable row level security;
drop policy if exists profile_self on profiles;
create policy profile_self on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profile_org_read on profiles;
create policy profile_org_read on profiles for select to authenticated
  using (exists (
    select 1 from memberships m1
    join memberships m2 on m1.org_id = m2.org_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  ));

alter table memberships enable row level security;
drop policy if exists membership_read on memberships;
create policy membership_read on memberships for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(org_id));
drop policy if exists membership_manage on memberships;
create policy membership_manage on memberships for all to authenticated
  using (public.has_org_role(org_id, array['owner','admin']::member_role[]))
  with check (public.has_org_role(org_id, array['owner','admin']::member_role[]));
drop policy if exists membership_bootstrap on memberships;
create policy membership_bootstrap on memberships for insert to authenticated
  with check (user_id = auth.uid());

-- ------------------------------------------------------------- storage ----
insert into storage.buckets (id, name, public)
values ('pr-media', 'pr-media', true)
on conflict (id) do nothing;

drop policy if exists pr_media_read on storage.objects;
create policy pr_media_read on storage.objects for select
  using (bucket_id = 'pr-media');

drop policy if exists pr_media_write on storage.objects;
create policy pr_media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'pr-media');

drop policy if exists pr_media_update on storage.objects;
create policy pr_media_update on storage.objects for update to authenticated
  using (bucket_id = 'pr-media');

-- ------------------------------------------- analytics helper functions ---
-- 顧客導線: 初回接触 / 中間 / 最終接触を集計して貢献度を返す
create or replace function public.attribution_summary(p_subject uuid, p_from timestamptz, p_to timestamptz)
returns table (
  content_id uuid,
  title text,
  first_touch int,
  mid_touch int,
  last_touch int,
  conversions int,
  revenue numeric
)
language sql
stable
security definer
set search_path = public
as $$
  -- 成果を出した訪問者を1人1行に畳んでから接触履歴と突き合わせる。
  -- (畳まずに join すると、接触 × 成果 の掛け算で件数が水増しされる)
  with conv as (
    select distinct on (c.visitor_id)
      c.visitor_id,
      coalesce(c.amount, 0) as amount
    from conversions c
    where c.subject_id = p_subject
      and c.occurred_at between p_from and p_to
      and c.visitor_id is not null
      and c.type in ('inquiry','booking','purchase','contract','doc_request','line_register')
    order by c.visitor_id, c.occurred_at desc
  ),
  tp as (
    select distinct t.visitor_id, t.content_id, t.position
    from touchpoints t
    join conv on conv.visitor_id = t.visitor_id
    where t.content_id is not null
  )
  select
    ci.id,
    ci.title,
    (count(*) filter (where tp.position = 'first'))::int,
    (count(*) filter (where tp.position = 'mid'))::int,
    (count(*) filter (where tp.position = 'last'))::int,
    (count(distinct tp.visitor_id))::int,
    -- 売上は「最後に行動を起こした接触」に帰属させ、二重計上を避ける
    coalesce(sum(conv.amount) filter (where tp.position = 'last'), 0)
  from tp
  join content_items ci on ci.id = tp.content_id
  join conv on conv.visitor_id = tp.visitor_id
  group by ci.id, ci.title
  order by 6 desc, 7 desc;
$$;

grant execute on function public.attribution_summary(uuid, timestamptz, timestamptz) to authenticated;

-- クリック数のアトミックな加算
create or replace function public.increment_link_click(p_code text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update tracking_links set clicks = clicks + 1 where code = p_code;
$$;
grant execute on function public.increment_link_click(text) to anon, authenticated;
