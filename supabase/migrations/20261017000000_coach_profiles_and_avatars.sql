-- Coach profiles: one row per auth user.
create table if not exists public.coach_profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  avatar_url    text,
  accreditation text check (accreditation in ('ECB_L3', 'BCCI_L2', 'CA_HP')),
  disciplines   text[] not null default '{}'
                check (disciplines <@ array['batting', 'pace', 'spin', 'keeping']::text[]),
  facility      text not null default '',
  pitch         text not null default '',
  schedules     jsonb not null default '[]'::jsonb check (jsonb_typeof(schedules) = 'array'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coach_profiles_set_updated_at on public.coach_profiles;
create trigger coach_profiles_set_updated_at
  before update on public.coach_profiles
  for each row execute function public.set_updated_at();

alter table public.coach_profiles enable row level security;

drop policy if exists "Coaches read own profile" on public.coach_profiles;
create policy "Coaches read own profile" on public.coach_profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Coaches create own profile" on public.coach_profiles;
create policy "Coaches create own profile" on public.coach_profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "Coaches update own profile" on public.coach_profiles;
create policy "Coaches update own profile" on public.coach_profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Avatars bucket: public read, each user writes only inside their own `<uid>/` folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users read own avatar folder" on storage.objects;
create policy "Users read own avatar folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
