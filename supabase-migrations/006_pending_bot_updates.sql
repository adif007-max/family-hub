-- ============================================================
-- Migration 006 — pending_bot_updates
-- Holds a single pending confirmable action per Telegram chat.
-- Service-role only (no RLS policies; webhook uses supabaseAdmin).
-- ============================================================

create table if not exists pending_bot_updates (
  chat_id    bigint primary key,
  action     jsonb  not null,
  reply      text   not null,
  created_at timestamptz default now()
);

alter table pending_bot_updates enable row level security;
