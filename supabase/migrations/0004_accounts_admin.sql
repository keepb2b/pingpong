-- ============================================================================
-- AI広報 — アカウント情報 / 運営管理者 / アバター
-- ============================================================================

-- ------------------------------------------------------- プロフィール拡張 --
alter table profiles add column if not exists is_platform_admin boolean not null default false;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists company_name text;
alter table profiles add column if not exists department text;
alter table profiles add column if not exists job_title text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists locale text not null default 'ja';
alter table profiles add column if not exists last_seen_at timestamptz;
alter table profiles add column if not exists updated_at timestamptz not null default now();

create index if not exists profiles_admin_idx on profiles(is_platform_admin) where is_platform_admin;

-- 運営管理者かどうか (RLSの再帰を避けるため security definer)
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_platform_admin from profiles p where p.id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_platform_admin() to authenticated;

-- 運営管理者は全ユーザーを閲覧できる
drop policy if exists profile_platform_admin on profiles;
create policy profile_platform_admin on profiles for select to authenticated
  using (public.is_platform_admin());

-- 最終ログイン日時の記録
create or replace function public.touch_last_seen()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update profiles set last_seen_at = now() where id = auth.uid();
$$;
grant execute on function public.touch_last_seen() to authenticated;

-- --------------------------------------------------------- アバター保管 ----
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

-- 自分のフォルダ (<uid>/...) にのみ書き込める
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 未認証でも登録時にアバターを上げられるようにする (サインアップ画面用)
-- 認証前は uid が無いため、一時フォルダ pending/ のみ許可する
drop policy if exists avatars_signup_write on storage.objects;
create policy avatars_signup_write on storage.objects for insert to anon
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'pending'
  );

-- --------------------------------------------- 運営管理者向けの横断ビュー --
-- 管理画面は service role 経由で読むが、SQLからも確認できるようにしておく
create or replace view public.admin_user_overview as
select
  p.id                                as user_id,
  p.email,
  p.display_name,
  p.avatar_url,
  p.company_name,
  p.phone,
  p.is_platform_admin,
  p.last_seen_at,
  p.created_at                        as registered_at,
  m.role                              as org_role,
  o.id                                as org_id,
  o.name                              as org_name,
  o.industry,
  o.onboarded_at,
  s.status                            as plan_status,
  s.setup_fee_paid,
  s.extra_subjects,
  s.current_period_end,
  (select count(*) from subjects sj where sj.org_id = o.id and sj.active) as subject_count,
  (select count(*) from content_items ci where ci.org_id = o.id)          as content_count,
  (select count(*) from posts po where po.org_id = o.id and po.status = 'published') as published_count,
  (select coalesce(sum(cv.amount), 0) from conversions cv where cv.org_id = o.id)    as revenue_total
from profiles p
left join memberships m on m.user_id = p.id
left join organizations o on o.id = m.org_id
left join subscriptions s on s.org_id = o.id;

-- ビューは呼び出し元の権限で評価される (security_invoker) ため、
-- 運営管理者以外は profiles のRLSにより自分の行しか見えない。
alter view public.admin_user_overview set (security_invoker = on);
grant select on public.admin_user_overview to authenticated;

-- --------------------------------------------------------- 決済履歴 -------
-- Stripe から取得した支払いを保持し、管理画面でリアルタイムに集計する
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete set null,
  stripe_payment_intent_id text unique,
  stripe_invoice_id text,
  stripe_customer_id text,
  amount bigint not null default 0,
  currency text not null default 'jpy',
  status text not null default 'succeeded',
  description text,
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_org_idx on payments(org_id, paid_at);
create index if not exists payments_paid_idx on payments(paid_at);

alter table payments enable row level security;
drop policy if exists payments_org_read on payments;
create policy payments_org_read on payments for select to authenticated
  using (org_id is not null and public.is_org_member(org_id));
drop policy if exists payments_admin_read on payments;
create policy payments_admin_read on payments for select to authenticated
  using (public.is_platform_admin());

-- updated_at トリガー
drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();
