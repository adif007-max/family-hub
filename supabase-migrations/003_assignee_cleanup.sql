-- ============================================================
-- Migration 003 — fix historical assignee bug + harden constraints
-- Two issues addressed:
--   1. Some tasks ended up with child names in `assignee` instead of
--      a valid parent value. Normalize and lock with CHECK.
--   2. `telegram_users.member_role` used 'tehila' but the rest of the
--      codebase uses 'tahel'. Align to 'tahel'.
-- ============================================================

-- 1. Move any invalid assignee values into 'both'
update tasks
set assignee = 'both'
where assignee not in ('adi', 'tahel', 'both');

-- 2. CHECK constraint on tasks.assignee
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_assignee_check'
  ) then
    alter table tasks
      add constraint tasks_assignee_check
      check (assignee in ('adi', 'tahel', 'both'));
  end if;
end $$;

-- 3. Align telegram_users.member_role: drop old CHECK, add new one
-- First update any 'tehila' rows to 'tahel' (defensive — none exist yet)
update telegram_users set member_role = 'tahel' where member_role = 'tehila';

do $$
declare cname text;
begin
  -- Drop any existing check on member_role
  select conname into cname
  from pg_constraint
  where conrelid = 'telegram_users'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%member_role%'
  limit 1;
  if cname is not null then
    execute format('alter table telegram_users drop constraint %I', cname);
  end if;

  alter table telegram_users
    add constraint telegram_users_role_check
    check (member_role in ('adi', 'tahel'));
end $$;
