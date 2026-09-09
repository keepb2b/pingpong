-- 確認メール（SMTP）なしで auth.users を確定する。
-- updateUserById(email_confirm) は SMTP 未設定だと "email is not configured" になる。

create or replace function public.confirm_user_email(uid uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  update auth.users
  set
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmation_token = '',
    confirmation_sent_at = null
  where id = uid;
end;
$$;

revoke all on function public.confirm_user_email(uuid) from public, anon, authenticated;
grant execute on function public.confirm_user_email(uuid) to service_role;
