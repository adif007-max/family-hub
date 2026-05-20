-- ============================================================
-- Family Hub — Migration 002
-- Telegram bot + family members + children detection
-- Paste this whole file into Supabase → SQL Editor → Run
-- ============================================================

-- 1. telegram_users: maps a Telegram chat to an auth user
create table if not exists telegram_users (
  chat_id     bigint primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  family_id   text not null,
  member_role text not null check (member_role in ('adi','tehila')),
  created_at  timestamptz default now()
);

alter table telegram_users enable row level security;
-- No policies on purpose: only service-role (webhook) can read/write.

-- Seed Adi's chat
insert into telegram_users (chat_id, user_id, family_id, member_role)
select 7121612087, p.user_id, p.family_id, 'adi'
from profiles p
join auth.users u on p.user_id = u.id
where u.email = 'adif007@gmail.com'
on conflict (chat_id) do nothing;

-- 2. family_members
create table if not exists family_members (
  id          uuid primary key default gen_random_uuid(),
  family_id   text not null,
  name        text not null,
  nicknames   text[] default '{}',
  birth_date  date,
  gender      text check (gender in ('male','female')),
  is_active   boolean default true,
  created_at  timestamptz default now()
);

alter table family_members enable row level security;

drop policy if exists "family members access" on family_members;
create policy "family members access" on family_members
  for all
  using      (family_id in (select family_id from profiles where user_id = auth.uid()))
  with check (family_id in (select family_id from profiles where user_id = auth.uid()));

-- Seed children (idempotent — won't duplicate)
insert into family_members (family_id, name, gender)
select 'fink', v.n, v.g from (values
  ('הלל',  'male'),
  ('רחל',  'female'),
  ('נעמי', 'female'),
  ('עוז',  'male')
) as v(n, g)
where not exists (
  select 1 from family_members fm
  where fm.family_id = 'fink' and fm.name = v.n
);

-- 3. tasks.related_member_ids
alter table tasks
  add column if not exists related_member_ids uuid[] default '{}';

-- 4. realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'family_members'
  ) then
    alter publication supabase_realtime add table family_members;
  end if;
end $$;
