-- Signup inserts into public.organizations via the service role.
-- "permission denied for table organizations" means the API role has no GRANT
-- (this is not an RLS policy failure; RLS would say "new row violates row-level security").
-- Tables created outside the dashboard sometimes skip the default grants.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;

-- Explicit for the table signup writes first
grant all on table public.organizations to postgres, anon, authenticated, service_role;
grant all on table public.memberships to postgres, anon, authenticated, service_role;
grant all on table public.profiles to postgres, anon, authenticated, service_role;
grant all on table public.subscriptions to postgres, anon, authenticated, service_role;
grant all on table public.subjects to postgres, anon, authenticated, service_role;
