-- Kindred Accounting · Phase 5: Board numbers
-- Run this whole file in the Supabase SQL Editor after 0004.

alter table public.reports
  drop constraint if exists reports_type_check;

alter table public.reports
  add constraint reports_type_check
  check (type in ('giving', 'board_numbers'));
