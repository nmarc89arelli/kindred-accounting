-- Kindred Accounting · Phase 3a: QuickBooks connection
-- Run this whole file in the Supabase SQL Editor after 0002.

create table public.qbo_connection (
  id integer primary key default 1 check (id = 1), -- single row
  env text not null check (env in ('sandbox', 'production')),
  realm_id text not null,
  access_token_enc text not null,
  refresh_token_enc text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  connected_by text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qbo_connection enable row level security;

-- No policies at all: encrypted tokens are reachable only through the
-- server with the secret key. Connection *status* is surfaced by the app
-- server-side; no client ever selects this table.
