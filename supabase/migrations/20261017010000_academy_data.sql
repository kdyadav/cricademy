-- Academy data owned by a coach: batches, cadets, attendance, net sessions and match plans.
-- Every table carries `coach_id` (defaults to the signed-in user) and RLS limits access to the owner.

create table if not exists public.net_batches (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 60),
  age_group   text not null check (age_group in ('U-14', 'U-16', 'U-19')),
  focus       text not null default '',
  start_time  text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time    text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  pitch       text not null default '',
  created_at  timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists net_batches_coach_idx on public.net_batches (coach_id);

create table if not exists public.cadets (
  id                 uuid primary key default gen_random_uuid(),
  coach_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  batch_id           uuid references public.net_batches (id) on delete set null,
  name               text not null check (char_length(name) between 1 and 80),
  jersey             integer not null check (jersey between 0 and 999),
  avatar_url         text,
  age_group          text not null check (age_group in ('U-14', 'U-16', 'U-19')),
  role               text not null check (role in ('Batter', 'Bowler', 'All-Rounder', 'Wicketkeeper')),
  batting_hand       text not null check (batting_hand in ('Right', 'Left')),
  bowling_style      text,
  link_status        text not null default 'unlinked' check (link_status in ('linked', 'pending', 'unlinked')),
  guardian           jsonb check (guardian is null or jsonb_typeof(guardian) = 'object'),
  invite_expires_at  timestamptz,
  fee_due            numeric(10, 2) not null default 0 check (fee_due >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists cadets_coach_idx on public.cadets (coach_id);
create index if not exists cadets_batch_idx on public.cadets (batch_id);

drop trigger if exists cadets_set_updated_at on public.cadets;
create trigger cadets_set_updated_at
  before update on public.cadets
  for each row execute function public.set_updated_at();

create table if not exists public.attendance_sheets (
  batch_id      uuid not null references public.net_batches (id) on delete cascade,
  date          date not null,
  coach_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  records       jsonb not null default '[]'::jsonb check (jsonb_typeof(records) = 'array'),
  submitted_at  timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (batch_id, date)
);
create index if not exists attendance_sheets_coach_idx on public.attendance_sheets (coach_id);

drop trigger if exists attendance_sheets_set_updated_at on public.attendance_sheets;
create trigger attendance_sheets_set_updated_at
  before update on public.attendance_sheets
  for each row execute function public.set_updated_at();

create table if not exists public.net_sessions (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cadet_id    uuid not null references public.cadets (id) on delete cascade,
  batch_id    uuid references public.net_batches (id) on delete set null,
  date        date not null,
  deliveries  jsonb not null check (jsonb_typeof(deliveries) = 'array'),
  saved_at    timestamptz not null default now()
);
create index if not exists net_sessions_coach_idx on public.net_sessions (coach_id);
create index if not exists net_sessions_batch_date_idx on public.net_sessions (batch_id, date);
create index if not exists net_sessions_cadet_idx on public.net_sessions (cadet_id);

create table if not exists public.match_plans (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opponent    text not null check (char_length(opponent) between 1 and 80),
  match_date  date not null,
  venue       text not null default '',
  format      text not null check (format in ('T20', 'One-day', 'Two-day', 'Friendly')),
  age_group   text not null check (age_group in ('U-14', 'U-16', 'U-19')),
  xi          uuid[] not null default '{}' check (cardinality(xi) <= 11),
  captain_id  uuid,
  keeper_id   uuid,
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists match_plans_coach_idx on public.match_plans (coach_id);

drop trigger if exists match_plans_set_updated_at on public.match_plans;
create trigger match_plans_set_updated_at
  before update on public.match_plans
  for each row execute function public.set_updated_at();

-- Owner-only access on every table.
do $$
declare
  t text;
begin
  foreach t in array array['net_batches', 'cadets', 'attendance_sheets', 'net_sessions', 'match_plans'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Coaches manage own rows" on public.%I', t);
    execute format(
      'create policy "Coaches manage own rows" on public.%I for all to authenticated '
      'using ((select auth.uid()) = coach_id) with check ((select auth.uid()) = coach_id)',
      t
    );
  end loop;
end
$$;
