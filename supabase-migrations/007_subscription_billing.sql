-- ============================================================
-- Migration 007 — subscription billing type
-- Adds billing_type ('monthly'|'yearly') and billing_day_of_month
-- for monthly subscriptions that recur on a fixed day each month.
-- ============================================================

alter table subscriptions
  add column if not exists billing_type text default 'yearly'
    check (billing_type in ('monthly', 'yearly'));

alter table subscriptions
  add column if not exists billing_day_of_month int
    check (billing_day_of_month >= 1 and billing_day_of_month <= 31);

-- Back-fill existing rows: yearly (they all have a renewal_date)
update subscriptions
set billing_type = 'yearly'
where billing_type is null;
