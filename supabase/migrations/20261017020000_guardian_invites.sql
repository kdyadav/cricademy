-- Guardian invites: single-use tokens (only the SHA-256 hash is stored), WhatsApp delivery status,
-- and RPCs for coaches to issue invites and for guardians to preview and accept them.

alter table public.cadets
  add column if not exists guardian_user_id uuid references auth.users (id) on delete set null;

create table if not exists public.guardian_invites (
  id               uuid primary key default gen_random_uuid(),
  cadet_id         uuid not null references public.cadets (id) on delete cascade,
  coach_id         uuid not null references auth.users (id) on delete cascade,
  token_hash       text not null unique,
  expires_at       timestamptz not null,
  delivery_status  text not null default 'pending' check (delivery_status in ('pending', 'sent', 'manual', 'failed')),
  wa_message_id    text,
  accepted_at      timestamptz,
  accepted_by      uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists guardian_invites_cadet_idx on public.guardian_invites (cadet_id);
create index if not exists guardian_invites_coach_idx on public.guardian_invites (coach_id);

-- Coaches can read their invites; all writes go through the functions below or the Edge Function.
alter table public.guardian_invites enable row level security;
drop policy if exists "Coaches read own invites" on public.guardian_invites;
create policy "Coaches read own invites" on public.guardian_invites
  for select to authenticated using ((select auth.uid()) = coach_id);

create or replace function public.hash_invite_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- Issues a fresh token for a cadet with a pending guardian; earlier unaccepted tokens stop working.
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
    where c.id = p_cadet_id and c.coach_id = (select auth.uid()) and c.link_status = 'pending'
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

-- Public preview for the invite page; reveals only names, and only to someone holding the token.
create or replace function public.get_guardian_invite(p_token text)
returns table (status text, cadet_name text, coach_name text, guardian_name text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when gi.accepted_at is not null then 'accepted'
      when c.link_status <> 'pending' then 'revoked'
      when gi.expires_at < now() then 'expired'
      else 'pending'
    end,
    c.name,
    coalesce(cp.name, 'Your coach'),
    c.guardian ->> 'name',
    gi.expires_at
  from public.guardian_invites gi
  join public.cadets c on c.id = gi.cadet_id
  left join public.coach_profiles cp on cp.id = gi.coach_id
  where gi.token_hash = public.hash_invite_token(p_token);
$$;

-- Links the signed-in user to the cadet as their verified guardian.
create or replace function public.accept_guardian_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.guardian_invites;
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
  if v_invite.coach_id = v_uid then
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

  update public.guardian_invites set accepted_at = now(), accepted_by = v_uid where id = v_invite.id;
  return 'accepted';
end;
$$;

revoke all on function public.create_guardian_invite(uuid, integer) from public, anon;
revoke all on function public.get_guardian_invite(text) from public;
revoke all on function public.accept_guardian_invite(text) from public, anon;
grant execute on function public.create_guardian_invite(uuid, integer) to authenticated;
grant execute on function public.get_guardian_invite(text) to anon, authenticated;
grant execute on function public.accept_guardian_invite(text) to authenticated;
