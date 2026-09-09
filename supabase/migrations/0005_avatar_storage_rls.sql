-- ============================================================================
-- AI広報 — アバター Storage RLS の修正
-- 登録直後はセッションが anon のまま、または foldername() が空になり
-- 「new row violates row-level security policy」になることがある。
-- パス判定を split_part に切り替え、pending / 自分の uid の両方を許可する。
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- 確認メール前（セッションなし / または authenticated だが uid フォルダ未使用）
drop policy if exists avatars_signup_write on storage.objects;
create policy avatars_signup_write on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'pending'
  );
