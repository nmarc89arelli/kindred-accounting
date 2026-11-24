-- Kindred Accounting · Phase 1
-- Run this whole file in the Supabase SQL Editor (or `supabase db push`).

-- =========================================================
-- Allowlist
-- =========================================================
create table public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  role text not null check (role in ('admin', 'exec', 'board')),
  active boolean not null default true,
  added_by text,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

alter table public.allowed_users enable row level security;

-- =========================================================
-- Audit log (append-only)
-- =========================================================
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_email text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb
);

alter table public.audit_log enable row level security;

-- No UPDATE or DELETE policies exist on audit_log, and none should ever be
-- added: rows go in and stay in. Writes happen through the server with the
-- secret key after the caller's role is verified.

-- =========================================================
-- Helper functions
-- =========================================================

-- The signed-in user's app role, or null if not on the active allowlist.
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from allowed_users
  where email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and active
  limit 1
$$;

revoke all on function public.my_role() from public;
grant execute on function public.my_role() to authenticated;

-- Stamp last_sign_in_at for the signed-in user.
create or replace function public.touch_sign_in()
returns void
language sql
security definer
set search_path = public
as $$
  update allowed_users
  set last_sign_in_at = now()
  where email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and active
$$;

revoke all on function public.touch_sign_in() from public;
grant execute on function public.touch_sign_in() to authenticated;

-- =========================================================
-- RLS policies
-- =========================================================

-- Admins can read the allowlist (the Users screen). All writes go through
-- the server with the secret key, so no insert/update/delete policies.
create policy "admins read allowlist"
  on public.allowed_users
  for select
  to authenticated
  using (public.my_role() = 'admin');

-- Admins can read the audit log.
create policy "admins read audit log"
  on public.audit_log
  for select
  to authenticated
  using (public.my_role() = 'admin');

-- =========================================================
-- Signup gate: Before User Created auth hook
-- =========================================================
-- Rejects account creation for any email not active on the allowlist, so
-- unauthorized people never get an auth user at all.
--
-- AFTER running this file, wire it up in the dashboard:
--   Authentication -> Hooks (or Auth Hooks) -> "Before User Created"
--   -> Postgres function -> schema: public, function: before_user_created_hook
create or replace function public.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  signup_email text;
begin
  signup_email := lower(coalesce(event -> 'user' ->> 'email', ''));

  if not exists (
    select 1 from allowed_users
    where email = signup_email and active
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'This account is not authorized for Kindred Accounting.'
      )
    );
  end if;

  return event;
end;
$$;

revoke all on function public.before_user_created_hook(jsonb) from public;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;

-- =========================================================
-- Seed
-- =========================================================
insert into public.allowed_users (email, role, added_by) values
  ('nate@wearekindred.church', 'admin', 'setup'),
  ('tyler@wearekindred.church', 'exec', 'setup');
