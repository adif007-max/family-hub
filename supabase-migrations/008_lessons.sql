-- ============================================================
-- Migration 008 — lessons (school timetable per child)
-- One row per lesson slot. Separate from schedules (activities).
-- ============================================================

create table if not exists lessons (
  id           uuid primary key default gen_random_uuid(),
  family_id    text not null,
  child_id     uuid references family_members(id) on delete cascade,
  school_name  text,
  day_of_week  text not null check (day_of_week in ('sun','mon','tue','wed','thu','fri','sat')),
  start_time   text not null,   -- "08:00"
  end_time     text not null,   -- "10:00"
  subject      text not null,
  teacher      text,
  created_at   timestamptz default now()
);

alter table lessons enable row level security;

create policy "lessons_family_select" on lessons for select
  using (family_id = (select family_id from profiles where id = auth.uid()));

create policy "lessons_family_insert" on lessons for insert
  with check (family_id = (select family_id from profiles where id = auth.uid()));

create policy "lessons_family_update" on lessons for update
  using (family_id = (select family_id from profiles where id = auth.uid()));

create policy "lessons_family_delete" on lessons for delete
  using (family_id = (select family_id from profiles where id = auth.uid()));

-- Enable realtime
alter publication supabase_realtime add table lessons;

-- ============================================================
-- Seed: הלל — ת"ת נווה
-- ============================================================
with hillel as (
  select id from family_members
  where family_id = 'fink' and name ilike '%הלל%'
  limit 1
)
insert into lessons (family_id, child_id, school_name, day_of_week, start_time, end_time, subject, teacher) values
  ('fink', (select id from hillel), 'ת"ת נווה', 'sun', '08:00', '10:00', 'תורה',        'הרב נדב'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'sun', '10:20', '11:50', 'עברית',       'הרב נדב'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'sun', '12:05', '13:30', 'תורה',        'הרב נדב'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'mon', '08:00', '10:00', 'תורה',        'הרב נדב'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'mon', '10:20', '11:50', 'עברית',       'הרב נדב'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'mon', '12:05', '13:30', 'תורה',        'הרב נדב'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'tue', '08:00', '10:00', 'תורה',        'הרב נדב'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'tue', '10:20', '11:50', 'עברית',       'הרב נדב'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'tue', '12:05', '13:30', 'תורה',        'הרב נדב'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'wed', '08:00', '10:00', 'תורה',        'הרב נדב'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'wed', '10:20', '11:50', 'עברית',       'הרב נדב'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'wed', '12:05', '13:30', 'חשבון',       'המורה נועה'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'thu', '08:00', '10:00', 'נביא',        'הרב איתן'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'thu', '10:20', '11:50', 'חשבון',       'המורה נועה'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'thu', '12:05', '12:50', 'אגדות חז"ל', 'הרב דורון'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'thu', '12:50', '13:30', 'התעמלות',    'אורי'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'fri', '08:00', '10:00', 'נביא',        'הרב איתן'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'fri', '10:20', '11:50', 'תורה',        'הרב נדב'),
  ('fink', (select id from hillel), 'ת"ת נווה', 'fri', '12:05', '12:50', 'קבלת שבת',   'הרב נדב');
