-- Kindred Accounting · Phase 2: Reports
-- Run this whole file in the Supabase SQL Editor after 0001.

-- =========================================================
-- Reports
-- =========================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('giving')),
  period date not null, -- first day of the report month
  title text not null,
  totals jsonb not null,
  tx_count integer not null default 0,
  token_hash text, -- sha256 hex of the share token; null = link revoked
  generated_by text not null,
  generated_at timestamptz not null default now(),
  unique (type, period)
);

alter table public.reports enable row level security;

-- =========================================================
-- Giving transactions (raw Tithe.ly rows behind each report)
-- =========================================================
create table public.giving_transactions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  amount numeric(12, 2) not null,
  first_name text,
  last_name text,
  location text,
  tx_date date not null,
  tx_time text,
  fees numeric(12, 2) not null default 0,
  status text not null,
  net_amount numeric(12, 2) not null default 0,
  covered_fees boolean not null default false,
  fund text not null,
  deposit_date date,
  deposit_time text,
  payment_type text,
  payment_method text
);

create index giving_transactions_report_idx
  on public.giving_transactions (report_id);

alter table public.giving_transactions enable row level security;

-- =========================================================
-- Share-link access log
-- =========================================================
create table public.report_views (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports (id) on delete cascade,
  at timestamptz not null default now(),
  ip text,
  user_agent text
);

alter table public.report_views enable row level security;

-- =========================================================
-- RLS
-- =========================================================

-- Admin and Exec see reports in full; Board sees report rows too (their
-- rendition is built from totals, which hold no donor names).
create policy "staff and board read reports"
  on public.reports
  for select
  to authenticated
  using (public.my_role() in ('admin', 'exec', 'board'));

-- Donor-level rows are Admin/Exec only. Board role gets aggregates, never rows.
create policy "staff read giving transactions"
  on public.giving_transactions
  for select
  to authenticated
  using (public.my_role() in ('admin', 'exec'));

create policy "staff read report views"
  on public.report_views
  for select
  to authenticated
  using (public.my_role() in ('admin', 'exec'));

-- All writes go through the server with the secret key. No insert/update/
-- delete policies on any of these tables, and report_views is append-only
-- by the same rule as audit_log.
