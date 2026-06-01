-- ============================================================
-- Migration 009 — cron_digest_log
-- Prevents duplicate morning digest sends on the same day.
-- Service-role only; no RLS needed (cron only).
-- ============================================================

create table if not exists cron_digest_log (
  family_id  text not null,
  log_date   date not null,
  sent_at    timestamptz default now(),
  primary key (family_id, log_date)
);

-- Auto-clean entries older than 7 days (optional; keeps table tiny)
-- Run manually or via pg_cron if available.
