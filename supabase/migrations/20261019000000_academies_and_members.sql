-- Academies with owner, coach and guardian members. Data rows now belong to an academy (`academy_id`);
-- `coach_id` stays as the user who created the row. Usernames are global so one login can join many academies.

-- Profiles: one row per auth user. `username` is set by the server when staff create the account.
create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  username              text unique check (username ~ '^[a-z0-9][a-z0-9._]{2,29}$'),
  display_name          text not null default '' check (char_length(display_name) <= 120),
  must_change_password  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Username and the password flag come from app metadata, which only the service role can write.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name, must_change_password)
  values (
    new.id,
    nullif(lower(new.raw_app_meta_data ->> 'username'), ''),
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1)), 120),
    coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.academies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists academies_owner_idx on public.academies (owner_id);

drop trigger if exists academies_set_updated_at on public.academies;
create trigger academies_set_updated_at
  before update on public.academies
  for each row execute function public.set_updated_at();

-- `pending` is used when staff add an existing user, who must accept before getting access.
create table if not exists public.academy_members (
  academy_id  uuid not null references public.academies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'coach', 'guardian')),
  status      text not null default 'active' check (status in ('active', 'pending')),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (academy_id, user_id)
);
create index if not exists academy_members_user_idx on public.academy_members (user_id);
create unique index if not exists academy_members_one_owner_idx on public.academy_members (academy_id) where role = 'owner';

create table if not exists public.batch_coaches (
  batch_id    uuid not null references public.net_batches (id) on delete cascade,
  coach_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (batch_id, coach_id)
);
create index if not exists batch_coaches_coach_idx on public.batch_coaches (coach_id);

create table if not exists public.cadet_guardians (
  cadet_id      uuid not null references public.cadets (id) on delete cascade,
  guardian_id   uuid not null references auth.users (id) on delete cascade,
  relationship  text not null default '' check (char_length(relationship) <= 40),
  created_at    timestamptz not null default now(),
  primary key (cadet_id, guardian_id)
);
create index if not exists cadet_guardians_guardian_idx on public.cadet_guardians (guardian_id);

-- Backfill: profiles for existing users, then one academy per existing coach, owned by that coach.
insert into public.profiles (id, display_name)
select u.id, left(coalesce(cp.name, g.name, split_part(coalesce(u.email, ''), '@', 1)), 120)
from auth.users u
left join public.coach_profiles cp on cp.id = u.id
left join lateral (
  select nullif(c.guardian ->> 'name', '') as name from public.cadets c where c.guardian_user_id = u.id limit 1
) g on true
on conflict (id) do nothing;

insert into public.academies (name, owner_id)
select coalesce(nullif(cp.name, '') || '''s Academy', 'My Academy'), o.coach_id
from (
  select id as coach_id from public.coach_profiles
  union select coach_id from public.net_batches
  union select coach_id from public.cadets
  union select coach_id from public.attendance_sheets
  union select coach_id from public.net_sessions
  union select coach_id from public.match_plans
  union select coach_id from public.fee_settings
  union select coach_id from public.fee_dues
) o
left join public.coach_profiles cp on cp.id = o.coach_id
where not exists (select 1 from public.academies a where a.owner_id = o.coach_id);

insert into public.academy_members (academy_id, user_id, role)
select a.id, a.owner_id, 'owner' from public.academies a
on conflict do nothing;

do $$
declare
  t text;
begin
  foreach t in array array['net_batches', 'cadets', 'attendance_sheets', 'net_sessions', 'match_plans', 'fee_settings', 'fee_dues'] loop
    execute format('alter table public.%I add column if not exists academy_id uuid references public.academies (id) on delete cascade', t);
    execute format(
      'update public.%I x set academy_id = a.id from public.academies a where x.academy_id is null and a.owner_id = x.coach_id', t
    );
    execute format('alter table public.%I alter column academy_id set not null', t);
    execute format('create index if not exists %I on public.%I (academy_id)', t || '_academy_idx', t);
  end loop;
end
$$;

-- Existing guardian links become guardian memberships.
insert into public.academy_members (academy_id, user_id, role)
select distinct c.academy_id, c.guardian_user_id, 'guardian'
from public.cadets c
where c.guardian_user_id is not null
on conflict do nothing;

insert into public.cadet_guardians (cadet_id, guardian_id)
select c.id, c.guardian_user_id from public.cadets c where c.guardian_user_id is not null
on conflict do nothing;

-- One payee per academy.
alter table public.fee_settings drop constraint if exists fee_settings_pkey;
alter table public.fee_settings add primary key (academy_id);


-- Access helpers. SECURITY DEFINER so policies can read memberships without recursing into RLS.
create or replace function public.has_academy_role(p_academy uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.academy_members m
    where m.academy_id = p_academy and m.user_id = (select auth.uid()) and m.status = 'active' and m.role = any (p_roles)
  );
$$;

create or replace function public.is_academy_owner(p_academy uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_academy_role(p_academy, array['owner']); $$;

create or replace function public.is_academy_staff(p_academy uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_academy_role(p_academy, array['owner', 'coach']); $$;

create or replace function public.is_academy_member(p_academy uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_academy_role(p_academy, array['owner', 'coach', 'guardian']); $$;

create or replace function public.batch_academy(p_batch uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select b.academy_id from public.net_batches b where b.id = p_batch; $$;

create or replace function public.cadet_academy(p_cadet uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select c.academy_id from public.cadets c where c.id = p_cadet; $$;

-- True when the signed-in user is an active staff member assigned to the batch.
create or replace function public.coaches_batch(p_batch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.batch_coaches bc
    join public.net_batches b on b.id = bc.batch_id
    join public.academy_members m
      on m.academy_id = b.academy_id and m.user_id = bc.coach_id and m.status = 'active' and m.role in ('owner', 'coach')
    where bc.batch_id = p_batch and bc.coach_id = (select auth.uid())
  );
$$;

-- Owners manage every cadet; coaches manage cadets in their batches, plus unbatched cadets they created.
create or replace function public.can_manage_cadet_row(p_academy uuid, p_batch uuid, p_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_academy_owner(p_academy)
    or (
      public.is_academy_staff(p_academy)
      and case
        when p_batch is null then p_created_by = (select auth.uid())
        else public.batch_academy(p_batch) = p_academy and public.coaches_batch(p_batch)
      end
    );
$$;

create or replace function public.can_manage_cadet(p_cadet uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.can_manage_cadet_row(c.academy_id, c.batch_id, c.coach_id) from public.cadets c where c.id = p_cadet),
    false
  );
$$;

create or replace function public.is_guardian_of(p_cadet uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cadet_guardians cg
    join public.cadets c on c.id = cg.cadet_id
    join public.academy_members m
      on m.academy_id = c.academy_id and m.user_id = cg.guardian_id and m.status = 'active' and m.role = 'guardian'
    where cg.cadet_id = p_cadet and cg.guardian_id = (select auth.uid())
  );
$$;

create or replace function public.guardian_of_batch(p_batch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cadets c
    where c.batch_id = p_batch and public.is_guardian_of(c.id)
  );
$$;

-- People can see each other when they share an active academy and at least one of them is staff.
-- Staff can also see members still pending in their academy.
create or replace function public.can_view_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user = (select auth.uid()) or exists (
    select 1
    from public.academy_members me
    join public.academy_members them on them.academy_id = me.academy_id
    where me.user_id = (select auth.uid()) and me.status = 'active'
      and them.user_id = p_user
      and (
        me.role in ('owner', 'coach')
        or (them.status = 'active' and them.role in ('owner', 'coach'))
      )
  );
$$;

-- Default academy for inserts that don't send `academy_id`: the user's owned academy, else their first coaching one.
create or replace function public.current_academy_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.academy_id from public.academy_members m
  where m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'coach')
  order by (m.role = 'owner') desc, m.created_at
  limit 1;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['net_batches', 'cadets', 'attendance_sheets', 'net_sessions', 'match_plans', 'fee_settings', 'fee_dues'] loop
    execute format('alter table public.%I alter column academy_id set default public.current_academy_id()', t);
  end loop;
end
$$;


-- Row level security. Membership rows are only written by the functions below or the service role.
alter table public.profiles enable row level security;
alter table public.academies enable row level security;
alter table public.academy_members enable row level security;
alter table public.batch_coaches enable row level security;
alter table public.cadet_guardians enable row level security;

drop policy if exists "Members read shared profiles" on public.profiles;
create policy "Members read shared profiles" on public.profiles
  for select to authenticated using (public.can_view_user(id));

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

drop policy if exists "Staff read academy coach profiles" on public.coach_profiles;
create policy "Staff read academy coach profiles" on public.coach_profiles
  for select to authenticated using (public.can_view_user(id));

drop policy if exists "Members read academy" on public.academies;
create policy "Members read academy" on public.academies
  for select to authenticated
  using (exists (select 1 from public.academy_members m where m.academy_id = academies.id and m.user_id = (select auth.uid())));

drop policy if exists "Owner updates academy" on public.academies;
create policy "Owner updates academy" on public.academies
  for update to authenticated using (public.is_academy_owner(id)) with check (public.is_academy_owner(id));

drop policy if exists "Read own and academy memberships" on public.academy_members;
create policy "Read own and academy memberships" on public.academy_members
  for select to authenticated using (user_id = (select auth.uid()) or public.is_academy_staff(academy_id));

drop policy if exists "Owner removes members or member leaves" on public.academy_members;
create policy "Owner removes members or member leaves" on public.academy_members
  for delete to authenticated
  using (role <> 'owner' and (user_id = (select auth.uid()) or public.is_academy_owner(academy_id)));

drop policy if exists "Staff read batch coaches" on public.batch_coaches;
create policy "Staff read batch coaches" on public.batch_coaches
  for select to authenticated using (public.is_academy_staff(public.batch_academy(batch_id)));

drop policy if exists "Owner assigns batch coaches" on public.batch_coaches;
create policy "Owner assigns batch coaches" on public.batch_coaches
  for insert to authenticated
  with check (
    public.is_academy_owner(public.batch_academy(batch_id))
    and exists (
      select 1 from public.academy_members m
      where m.academy_id = public.batch_academy(batch_id) and m.user_id = coach_id
        and m.status = 'active' and m.role in ('owner', 'coach')
    )
  );

drop policy if exists "Owner unassigns batch coaches" on public.batch_coaches;
create policy "Owner unassigns batch coaches" on public.batch_coaches
  for delete to authenticated using (public.is_academy_owner(public.batch_academy(batch_id)));

drop policy if exists "Read cadet guardians" on public.cadet_guardians;
create policy "Read cadet guardians" on public.cadet_guardians
  for select to authenticated using (guardian_id = (select auth.uid()) or public.can_manage_cadet(cadet_id));

drop policy if exists "Staff link academy guardians" on public.cadet_guardians;
create policy "Staff link academy guardians" on public.cadet_guardians
  for insert to authenticated
  with check (
    public.can_manage_cadet(cadet_id)
    and exists (
      select 1 from public.academy_members m
      where m.academy_id = public.cadet_academy(cadet_id) and m.user_id = guardian_id
        and m.status = 'active' and m.role = 'guardian'
    )
  );

drop policy if exists "Staff update cadet guardians" on public.cadet_guardians;
create policy "Staff update cadet guardians" on public.cadet_guardians
  for update to authenticated using (public.can_manage_cadet(cadet_id)) with check (public.can_manage_cadet(cadet_id));

drop policy if exists "Staff unlink cadet guardians" on public.cadet_guardians;
create policy "Staff unlink cadet guardians" on public.cadet_guardians
  for delete to authenticated using (public.can_manage_cadet(cadet_id));

-- Data tables: replace owner-only policies with academy roles.
do $$
declare
  t text;
begin
  foreach t in array array['net_batches', 'cadets', 'attendance_sheets', 'net_sessions', 'match_plans', 'fee_settings', 'fee_dues'] loop
    execute format('drop policy if exists "Coaches manage own rows" on public.%I', t);
  end loop;
end
$$;

drop policy if exists "Read batches" on public.net_batches;
create policy "Read batches" on public.net_batches
  for select to authenticated
  using (public.is_academy_owner(academy_id) or public.coaches_batch(id) or public.guardian_of_batch(id));

drop policy if exists "Owner creates batches" on public.net_batches;
create policy "Owner creates batches" on public.net_batches
  for insert to authenticated
  with check (public.is_academy_owner(academy_id) and coach_id = (select auth.uid()));

drop policy if exists "Owner or batch coach updates batches" on public.net_batches;
create policy "Owner or batch coach updates batches" on public.net_batches
  for update to authenticated
  using (public.is_academy_owner(academy_id) or public.coaches_batch(id))
  with check (public.is_academy_owner(academy_id) or public.coaches_batch(id));

drop policy if exists "Owner deletes batches" on public.net_batches;
create policy "Owner deletes batches" on public.net_batches
  for delete to authenticated using (public.is_academy_owner(academy_id));

drop policy if exists "Read cadets" on public.cadets;
create policy "Read cadets" on public.cadets
  for select to authenticated
  using (public.can_manage_cadet_row(academy_id, batch_id, coach_id) or public.is_guardian_of(id));

drop policy if exists "Staff create cadets" on public.cadets;
create policy "Staff create cadets" on public.cadets
  for insert to authenticated
  with check (
    coach_id = (select auth.uid())
    and (batch_id is null or public.batch_academy(batch_id) = academy_id)
    and public.can_manage_cadet_row(academy_id, batch_id, coach_id)
  );

drop policy if exists "Staff update cadets" on public.cadets;
create policy "Staff update cadets" on public.cadets
  for update to authenticated
  using (public.can_manage_cadet_row(academy_id, batch_id, coach_id))
  with check (
    (batch_id is null or public.batch_academy(batch_id) = academy_id)
    and public.can_manage_cadet_row(academy_id, batch_id, coach_id)
  );

drop policy if exists "Staff delete cadets" on public.cadets;
create policy "Staff delete cadets" on public.cadets
  for delete to authenticated using (public.can_manage_cadet_row(academy_id, batch_id, coach_id));

drop policy if exists "Owner or batch coach manages attendance" on public.attendance_sheets;
create policy "Owner or batch coach manages attendance" on public.attendance_sheets
  for all to authenticated
  using (public.is_academy_owner(academy_id) or public.coaches_batch(batch_id))
  with check (
    public.batch_academy(batch_id) = academy_id
    and (public.is_academy_owner(academy_id) or public.coaches_batch(batch_id))
  );

drop policy if exists "Read net sessions" on public.net_sessions;
create policy "Read net sessions" on public.net_sessions
  for select to authenticated using (public.can_manage_cadet(cadet_id) or public.is_guardian_of(cadet_id));

drop policy if exists "Staff write net sessions" on public.net_sessions;
create policy "Staff write net sessions" on public.net_sessions
  for insert to authenticated
  with check (public.cadet_academy(cadet_id) = academy_id and public.can_manage_cadet(cadet_id));

drop policy if exists "Staff update net sessions" on public.net_sessions;
create policy "Staff update net sessions" on public.net_sessions
  for update to authenticated
  using (public.can_manage_cadet(cadet_id))
  with check (public.cadet_academy(cadet_id) = academy_id and public.can_manage_cadet(cadet_id));

drop policy if exists "Staff delete net sessions" on public.net_sessions;
create policy "Staff delete net sessions" on public.net_sessions
  for delete to authenticated using (public.can_manage_cadet(cadet_id));

drop policy if exists "Staff read match plans" on public.match_plans;
create policy "Staff read match plans" on public.match_plans
  for select to authenticated using (public.is_academy_staff(academy_id));

drop policy if exists "Staff create match plans" on public.match_plans;
create policy "Staff create match plans" on public.match_plans
  for insert to authenticated
  with check (public.is_academy_staff(academy_id) and coach_id = (select auth.uid()));

drop policy if exists "Owner or author updates match plans" on public.match_plans;
create policy "Owner or author updates match plans" on public.match_plans
  for update to authenticated
  using (public.is_academy_owner(academy_id) or (public.is_academy_staff(academy_id) and coach_id = (select auth.uid())))
  with check (public.is_academy_owner(academy_id) or (public.is_academy_staff(academy_id) and coach_id = (select auth.uid())));

drop policy if exists "Owner or author deletes match plans" on public.match_plans;
create policy "Owner or author deletes match plans" on public.match_plans
  for delete to authenticated
  using (public.is_academy_owner(academy_id) or (public.is_academy_staff(academy_id) and coach_id = (select auth.uid())));

drop policy if exists "Staff read fee settings" on public.fee_settings;
create policy "Staff read fee settings" on public.fee_settings
  for select to authenticated using (public.is_academy_staff(academy_id));

drop policy if exists "Owner manages fee settings" on public.fee_settings;
create policy "Owner manages fee settings" on public.fee_settings
  for all to authenticated
  using (public.is_academy_owner(academy_id)) with check (public.is_academy_owner(academy_id));

drop policy if exists "Read fee dues" on public.fee_dues;
create policy "Read fee dues" on public.fee_dues
  for select to authenticated
  using (public.is_academy_owner(academy_id) or public.can_manage_cadet(cadet_id) or public.is_guardian_of(cadet_id));

drop policy if exists "Owner manages fee dues" on public.fee_dues;
create policy "Owner manages fee dues" on public.fee_dues
  for all to authenticated
  using (public.is_academy_owner(academy_id))
  with check (public.is_academy_owner(academy_id) and public.cadet_academy(cadet_id) = academy_id);


-- Rows cannot move between academies.
create or replace function public.prevent_academy_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.academy_id is distinct from old.academy_id then
    raise exception 'Rows cannot be moved to another academy' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['net_batches', 'cadets', 'attendance_sheets', 'net_sessions', 'match_plans', 'fee_settings', 'fee_dues'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_lock_academy', t);
    execute format(
      'create trigger %I before update of academy_id on public.%I for each row execute function public.prevent_academy_change()',
      t || '_lock_academy', t
    );
  end loop;
end
$$;

-- Registers and net sessions belong to the academy of their batch or cadet, whatever the client sends.
create or replace function public.inherit_academy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'attendance_sheets' then
    new.academy_id := coalesce(public.batch_academy(new.batch_id), new.academy_id);
  elsif tg_table_name = 'net_sessions' then
    new.academy_id := coalesce(public.cadet_academy(new.cadet_id), new.academy_id);
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_sheets_inherit_academy on public.attendance_sheets;
create trigger attendance_sheets_inherit_academy
  before insert on public.attendance_sheets
  for each row execute function public.inherit_academy();

drop trigger if exists net_sessions_inherit_academy on public.net_sessions;
create trigger net_sessions_inherit_academy
  before insert on public.net_sessions
  for each row execute function public.inherit_academy();

-- Leaving an academy removes the member's batch assignments and guardian links there.
create or replace function public.cleanup_removed_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.batch_coaches bc
  using public.net_batches b
  where bc.batch_id = b.id and b.academy_id = old.academy_id and bc.coach_id = old.user_id;

  delete from public.cadet_guardians cg
  using public.cadets c
  where cg.cadet_id = c.id and c.academy_id = old.academy_id and cg.guardian_id = old.user_id;

  update public.cadets
  set guardian_user_id = null, link_status = 'unlinked'
  where academy_id = old.academy_id and guardian_user_id = old.user_id;
  return null;
end;
$$;

drop trigger if exists academy_members_cleanup on public.academy_members;
create trigger academy_members_cleanup
  after delete on public.academy_members
  for each row execute function public.cleanup_removed_member();

-- A coach who signs up on their own (no staff membership yet) becomes the owner of a new academy.
create or replace function public.ensure_owner_academy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_academy uuid;
begin
  if exists (
    select 1 from public.academy_members m where m.user_id = new.id and m.role in ('owner', 'coach')
  ) then
    return new;
  end if;
  insert into public.academies (name, owner_id)
  values (left(coalesce(nullif(new.name, ''), 'My') || '''s Academy', 120), new.id)
  returning id into v_academy;
  insert into public.academy_members (academy_id, user_id, role) values (v_academy, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists coach_profiles_ensure_academy on public.coach_profiles;
create trigger coach_profiles_ensure_academy
  after insert on public.coach_profiles
  for each row execute function public.ensure_owner_academy();

-- Lets a signed-in user open another academy that they own.
create or replace function public.create_academy(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_academy uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to create an academy' using errcode = '28000';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'Academy name must be 1 to 120 characters' using errcode = '22023';
  end if;
  insert into public.academies (name, owner_id) values (v_name, v_uid) returning id into v_academy;
  insert into public.academy_members (academy_id, user_id, role) values (v_academy, v_uid, 'owner');
  return v_academy;
end;
$$;

-- Accepts or declines a pending membership the signed-in user was added to.
-- Accepting as a guardian also confirms the cadet links made while pending; declining removes them.
create or replace function public.respond_to_membership(p_academy_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_accept then
    update public.academy_members set status = 'active'
    where academy_id = p_academy_id and user_id = v_uid and status = 'pending';
    if found then
      update public.cadets
      set link_status = 'linked', invite_expires_at = null,
          guardian = case when guardian is null then null else jsonb_set(guardian, '{verified}', 'true'::jsonb) end
      where academy_id = p_academy_id and guardian_user_id = v_uid and link_status = 'pending';
    end if;
  else
    delete from public.academy_members
    where academy_id = p_academy_id and user_id = v_uid and status = 'pending';
  end if;
  if not found then
    raise exception 'No pending invitation for this academy' using errcode = 'P0002';
  end if;
end;
$$;

-- Called by the app after the user sets their own password on first login.
create or replace function public.complete_password_change()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false where id = (select auth.uid());
$$;


-- Pay page: payee now comes from the academy's fee settings.
create or replace function public.get_fee_payment(p_due_id uuid)
returns table (
  status text, title text, amount numeric, due_date date, cadet_name text,
  payee_name text, upi_id text, reported boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.status, d.title, d.amount, d.due_date, c.name, s.payee_name, s.upi_id, d.reported_at is not null
  from public.fee_dues d
  join public.cadets c on c.id = d.cadet_id
  left join public.fee_settings s on s.academy_id = d.academy_id
  where d.id = p_due_id;
$$;

-- Guardian invites: any staff member who manages the cadet can issue one.
create or replace function public.create_guardian_invite(p_cadet_id uuid, p_ttl_hours integer default 48)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires timestamptz := now() + make_interval(hours => greatest(1, least(p_ttl_hours, 168)));
  v_id uuid;
begin
  if not exists (
    select 1 from public.cadets c
    where c.id = p_cadet_id and c.link_status = 'pending' and public.can_manage_cadet(c.id)
  ) then
    raise exception 'No pending guardian invite for this cadet' using errcode = 'P0002';
  end if;

  delete from public.guardian_invites gi where gi.cadet_id = p_cadet_id and gi.accepted_at is null;

  insert into public.guardian_invites (cadet_id, coach_id, token_hash, expires_at)
  values (p_cadet_id, (select auth.uid()), public.hash_invite_token(v_token), v_expires)
  returning id into v_id;

  update public.cadets set invite_expires_at = v_expires where id = p_cadet_id;

  return query select v_id, v_token, v_expires;
end;
$$;

-- Accepting an invite also makes the user a guardian member of the cadet's academy.
create or replace function public.accept_guardian_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.guardian_invites;
  v_academy uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to accept this invite' using errcode = '28000';
  end if;

  select * into v_invite from public.guardian_invites
  where token_hash = public.hash_invite_token(p_token)
  for update;

  if not found then
    raise exception 'This invite link is not valid' using errcode = 'P0002';
  end if;
  if v_invite.accepted_at is not null then
    if v_invite.accepted_by = v_uid then return 'accepted'; end if;
    raise exception 'This invite has already been used' using errcode = 'P0001';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired. Ask the coach to resend it.' using errcode = 'P0001';
  end if;

  select c.academy_id into v_academy from public.cadets c where c.id = v_invite.cadet_id;
  if v_invite.coach_id = v_uid or exists (
    select 1 from public.academy_members m
    where m.academy_id = v_academy and m.user_id = v_uid and m.role in ('owner', 'coach')
  ) then
    raise exception 'Coaches cannot accept their own invites' using errcode = 'P0001';
  end if;

  update public.cadets
  set link_status = 'linked',
      guardian_user_id = v_uid,
      guardian = coalesce(guardian, '{}'::jsonb) || jsonb_build_object('verified', true),
      invite_expires_at = null
  where id = v_invite.cadet_id and link_status = 'pending';
  if not found then
    raise exception 'This invite was cancelled by the coach' using errcode = 'P0001';
  end if;

  insert into public.academy_members (academy_id, user_id, role, invited_by)
  values (v_academy, v_uid, 'guardian', v_invite.coach_id)
  on conflict (academy_id, user_id) do update set status = 'active';
  insert into public.cadet_guardians (cadet_id, guardian_id) values (v_invite.cadet_id, v_uid)
  on conflict do nothing;

  update public.guardian_invites set accepted_at = now(), accepted_by = v_uid where id = v_invite.id;
  return 'accepted';
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prevent_academy_change() from public, anon, authenticated;
revoke all on function public.inherit_academy() from public, anon, authenticated;
revoke all on function public.cleanup_removed_member() from public, anon, authenticated;
revoke all on function public.ensure_owner_academy() from public, anon, authenticated;
revoke all on function public.create_academy(text) from public, anon;
revoke all on function public.respond_to_membership(uuid, boolean) from public, anon;
revoke all on function public.complete_password_change() from public, anon;
grant execute on function public.create_academy(text) to authenticated;
grant execute on function public.respond_to_membership(uuid, boolean) to authenticated;
grant execute on function public.complete_password_change() to authenticated;
