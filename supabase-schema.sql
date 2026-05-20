-- ============================================================
-- Family Hub — Supabase schema
-- Paste this whole file into Supabase → SQL Editor → Run
-- ============================================================

-- 1. Allowed emails (only these people get into the family)
create table if not exists allowed_emails (
  email text primary key,
  family_id text not null
);

insert into allowed_emails (email, family_id) values
  ('adif007@gmail.com', 'fink'),
  ('tehila1000@gmail.com', 'fink')
on conflict (email) do nothing;

-- 2. Profiles: maps an auth user to a family
create table if not exists profiles (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  family_id text not null,
  name      text
);

-- 3. Tasks
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  family_id   text not null,
  created_at  timestamptz default now(),
  text        text not null,
  category    text not null,
  assignee    text not null,
  priority    text not null,
  due_date    date,
  recur       text default '',
  note        text default '',
  done        boolean default false,
  done_at     timestamptz,
  stuck_since timestamptz
);

-- 4. Auto-create a profile on signup, only for allowed emails
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (user_id, family_id, name)
  select new.id, ae.family_id, split_part(new.email, '@', 1)
  from allowed_emails ae
  where ae.email = new.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 5. Row Level Security
alter table profiles enable row level security;
alter table tasks    enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for select using (user_id = auth.uid());

drop policy if exists "family tasks" on tasks;
create policy "family tasks" on tasks
  for all
  using      (family_id in (select family_id from profiles where user_id = auth.uid()))
  with check (family_id in (select family_id from profiles where user_id = auth.uid()));

-- 6. Enable realtime on tasks
alter publication supabase_realtime add table tasks;
