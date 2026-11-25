-- Kindred Accounting · Phase 3c: Reimbursements
-- Run this whole file in the Supabase SQL Editor after 0003.

create table public.reimbursements (
  id uuid primary key default gen_random_uuid(),
  source_id integer not null unique, -- intranet submission id
  name text not null,
  email text not null,
  phone text,
  description text not null,
  amount numeric(12, 2) not null,
  receipt_urls jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'check_written', 'void')),
  check_number text,
  category_name text,
  class_name text,
  bank_account_name text,
  qbo_purchase_id text,
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.reimbursements enable row level security;

-- Admin and Exec read the queue; all writes go through the server (the
-- webhook endpoint and confirm action) with the secret key.
create policy "staff read reimbursements"
  on public.reimbursements
  for select
  to authenticated
  using (public.my_role() in ('admin', 'exec'));
