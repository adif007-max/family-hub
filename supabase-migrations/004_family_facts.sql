-- ============================================================
-- Migration 004 — Family Facts: vehicles, subscriptions, schedules
-- + source linkage on tasks for auto-generated reminders
-- ============================================================

-- 1. vehicles
create table if not exists vehicles (
  id                       uuid primary key default gen_random_uuid(),
  family_id                text not null,
  make                     text not null,
  model                    text,
  year                     int,
  license_plate            text,
  test_expiry_date         date,
  insurance_renewal_date   date,
  insurance_policy_number  text,
  notes                    text,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

alter table vehicles enable row level security;
drop policy if exists "vehicles access" on vehicles;
create policy "vehicles access" on vehicles
  for all
  using      (family_id in (select family_id from profiles where user_id = auth.uid()))
  with check (family_id in (select family_id from profiles where user_id = auth.uid()));

-- 2. subscriptions
create table if not exists subscriptions (
  id             uuid primary key default gen_random_uuid(),
  family_id      text not null,
  name           text not null,
  monthly_cost   numeric(10,2),
  currency       text default 'ILS',
  renewal_date   date,
  account_email  text,
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table subscriptions enable row level security;
drop policy if exists "subscriptions access" on subscriptions;
create policy "subscriptions access" on subscriptions
  for all
  using      (family_id in (select family_id from profiles where user_id = auth.uid()))
  with check (family_id in (select family_id from profiles where user_id = auth.uid()));

-- 3. schedules
create table if not exists schedules (
  id              uuid primary key default gen_random_uuid(),
  family_id       text not null,
  child_id        uuid references family_members(id) on delete cascade,
  activity_type   text check (activity_type in ('school','kindergarten','class','meeting')),
  activity_name   text not null,
  days_of_week    text[] not null default '{}',
  start_time      text,
  end_time        text,
  location        text,
  contact_phone   text,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table schedules enable row level security;
drop policy if exists "schedules access" on schedules;
create policy "schedules access" on schedules
  for all
  using      (family_id in (select family_id from profiles where user_id = auth.uid()))
  with check (family_id in (select family_id from profiles where user_id = auth.uid()));

-- 4. source linkage on tasks (prevents duplicate auto-reminders)
alter table tasks add column if not exists source_fact_id    uuid;
alter table tasks add column if not exists source_fact_table text;

create index if not exists tasks_source_fact_idx
  on tasks(source_fact_id, source_fact_table);

-- 5. realtime for the new tables
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='vehicles')
    then alter publication supabase_realtime add table vehicles; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='subscriptions')
    then alter publication supabase_realtime add table subscriptions; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='schedules')
    then alter publication supabase_realtime add table schedules; end if;
end $$;
