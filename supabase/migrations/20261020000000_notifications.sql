-- In-app notifications and Web Push. Rows are written by triggers on academy events; each new row is also
-- sent to the user's installed devices by the `send-push` Edge Function, called through pg_net.
-- Push delivery needs two Vault secrets: `project_url` (https://<ref>.supabase.co) and `push_webhook_secret`
-- (same value as the function's PUSH_WEBHOOK_SECRET). Without them notifications stay in-app only.

create extension if not exists pg_net with schema extensions;

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  academy_id  uuid references public.academies (id) on delete cascade,
  kind        text not null check (char_length(kind) <= 40),
  title       text not null check (char_length(title) between 1 and 120),
  body        text not null default '' check (char_length(body) <= 300),
  url         text check (url ~ '^/' and char_length(url) <= 200),
  tone        text not null default 'info' check (tone in ('info', 'alert', 'success')),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- One row per browser push endpoint; a device signed into another account moves to that account.
create table if not exists public.push_subscriptions (
  endpoint    text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  user_id     uuid not null references auth.users (id) on delete cascade,
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  user_agent  text not null default '' check (char_length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users mark own notifications read" on public.notifications;
create policy "Users mark own notifications read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own notifications" on public.notifications;
create policy "Users delete own notifications" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists "Users read own push subscriptions" on public.push_subscriptions;
create policy "Users read own push subscriptions" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users delete own push subscriptions" on public.push_subscriptions;
create policy "Users delete own push subscriptions" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

revoke insert, update on public.push_subscriptions from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

-- Registers this browser's push endpoint for the signed-in user.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sign in to turn on alerts' using errcode = '28000';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
  values (p_endpoint, v_uid, p_p256dh, p_auth, left(coalesce(p_user_agent, ''), 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;

-- Creates a notification unless the recipient is the person who caused it.
create or replace function public.notify_user(
  p_user uuid, p_academy uuid, p_kind text, p_title text, p_body text, p_url text, p_tone text default 'info'
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, academy_id, kind, title, body, url, tone)
  select p_user, p_academy, p_kind, left(p_title, 120), left(coalesce(p_body, ''), 300), p_url, p_tone
  where p_user is not null and p_user is distinct from (select auth.uid());
$$;

-- Active guardians linked to the cadet.
create or replace function public.cadet_guardian_ids(p_cadet uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cg.guardian_id
  from public.cadet_guardians cg
  join public.cadets c on c.id = cg.cadet_id
  join public.academy_members m
    on m.academy_id = c.academy_id and m.user_id = cg.guardian_id and m.status = 'active' and m.role = 'guardian'
  where cg.cadet_id = p_cadet;
$$;

create or replace function public.academy_owner_id(p_academy uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id from public.academy_members m
  where m.academy_id = p_academy and m.role = 'owner' and m.status = 'active'
  limit 1;
$$;

create or replace function public.format_inr(p_amount numeric)
returns text
language sql
immutable
set search_path = ''
as $$ select '₹' || trim_scale(p_amount)::text; $$;


-- Fees: guardians hear about new dues, reminders and confirmed payments; the owner hears about reported payments.
create or replace function public.notify_fee_due_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cadet text;
  v_guardian uuid;
  v_line text;
begin
  select c.name into v_cadet from public.cadets c where c.id = new.cadet_id;
  v_line := new.title || ' for ' || coalesce(v_cadet, 'your cadet') || ': ' || public.format_inr(new.amount);

  if tg_op = 'INSERT' then
    foreach v_guardian in array array(select public.cadet_guardian_ids(new.cadet_id)) loop
      perform public.notify_user(v_guardian, new.academy_id, 'fee_due', 'New fee due',
        v_line || ', due ' || to_char(new.due_date, 'FMDD Mon'), '/home', 'alert');
    end loop;
    return null;
  end if;

  if new.status = 'paid' and old.status <> 'paid' then
    foreach v_guardian in array array(select public.cadet_guardian_ids(new.cadet_id)) loop
      perform public.notify_user(v_guardian, new.academy_id, 'fee_paid', 'Payment received', v_line, '/home', 'success');
    end loop;
  elsif new.status = 'due' and new.reminded_at is not null and new.reminded_at is distinct from old.reminded_at then
    foreach v_guardian in array array(select public.cadet_guardian_ids(new.cadet_id)) loop
      perform public.notify_user(v_guardian, new.academy_id, 'fee_reminder', 'Fee reminder',
        v_line || ', due ' || to_char(new.due_date, 'FMDD Mon'), '/home', 'alert');
    end loop;
  end if;

  if new.reported_at is not null and old.reported_at is null then
    perform public.notify_user(public.academy_owner_id(new.academy_id), new.academy_id, 'fee_reported', 'Payment reported',
      v_line || ' (UTR ' || coalesce(new.reported_reference, '-') || ')', '/fees', 'info');
  end if;
  return null;
end;
$$;

drop trigger if exists fee_dues_notify on public.fee_dues;
create trigger fee_dues_notify
  after insert or update of status, reminded_at, reported_at on public.fee_dues
  for each row execute function public.notify_fee_due_change();

-- Attendance: once a register is first submitted, each cadet's guardians get that cadet's mark.
create or replace function public.notify_attendance_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_guardian uuid;
  v_mark text;
begin
  if new.submitted_at is null or (tg_op = 'UPDATE' and old.submitted_at is not null) then
    return null;
  end if;
  for r in
    select c.id, c.name, rec->>'status' as status, (rec->>'lateMinutes')::integer as late
    from jsonb_array_elements(new.records) rec
    join public.cadets c on c.id::text = rec->>'cadetId'
  loop
    v_mark := case r.status
      when 'late' then 'late' || coalesce(' by ' || r.late || ' min', '')
      else coalesce(r.status, 'marked')
    end;
    foreach v_guardian in array array(select public.cadet_guardian_ids(r.id)) loop
      perform public.notify_user(v_guardian, new.academy_id, 'attendance', 'Attendance marked',
        r.name || ' was ' || v_mark || ' on ' || to_char(new.date, 'FMDD Mon'), '/home',
        case when r.status in ('absent', 'injured') then 'alert' else 'info' end);
    end loop;
  end loop;
  return null;
end;
$$;

drop trigger if exists attendance_sheets_notify on public.attendance_sheets;
create trigger attendance_sheets_notify
  after insert or update of submitted_at on public.attendance_sheets
  for each row execute function public.notify_attendance_submitted();

-- Memberships: the added user hears about a pending invitation; whoever added them hears when they accept.
create or replace function public.notify_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_academy text;
  v_name text;
begin
  select coalesce(a.name, 'the academy') into v_academy from public.academies a where a.id = new.academy_id;
  if tg_op = 'INSERT' and new.status = 'pending' then
    select p.display_name into v_name from public.profiles p where p.id = new.invited_by;
    perform public.notify_user(new.user_id, new.academy_id, 'membership_invite', 'Academy invitation',
      coalesce(nullif(v_name, ''), 'Staff') || ' added you to ' || v_academy || ' as ' || new.role, '/academies', 'info');
  elsif tg_op = 'UPDATE' and new.status = 'active' and old.status = 'pending' then
    select coalesce(nullif(p.display_name, ''), p.username, 'A member') into v_name from public.profiles p where p.id = new.user_id;
    perform public.notify_user(new.invited_by, new.academy_id, 'membership_accepted', 'Invitation accepted',
      coalesce(v_name, 'A member') || ' joined ' || v_academy || ' as ' || new.role,
      case when new.role = 'coach' then '/coaches' else '/cadets' end, 'success');
  end if;
  return null;
end;
$$;

drop trigger if exists academy_members_notify on public.academy_members;
create trigger academy_members_notify
  after insert or update of status on public.academy_members
  for each row execute function public.notify_membership_change();

-- Guardian invite links: the coach who sent the invite hears when it is accepted.
create or replace function public.notify_guardian_invite_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cadet record;
  v_name text;
begin
  if new.accepted_at is null or old.accepted_at is not null then
    return null;
  end if;
  select c.name, c.academy_id into v_cadet from public.cadets c where c.id = new.cadet_id;
  select coalesce(nullif(p.display_name, ''), p.username) into v_name from public.profiles p where p.id = new.accepted_by;
  perform public.notify_user(new.coach_id, v_cadet.academy_id, 'guardian_linked', 'Guardian linked',
    coalesce(v_name, 'A guardian') || ' accepted the invite for ' || coalesce(v_cadet.name, 'a cadet'), '/cadets', 'success');
  return null;
end;
$$;

drop trigger if exists guardian_invites_notify on public.guardian_invites;
create trigger guardian_invites_notify
  after update of accepted_at on public.guardian_invites
  for each row execute function public.notify_guardian_invite_accepted();

-- Hands each new notification to the `send-push` Edge Function. Failures never block the event that caused it.
create or replace function public.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.push_subscriptions s where s.user_id = new.user_id) then
    return null;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object('notification_id', new.id),
    timeout_milliseconds := 5000
  );
  return null;
exception when others then
  raise warning 'dispatch_push failed: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_push();

revoke all on function public.notify_user(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.cadet_guardian_ids(uuid) from public, anon, authenticated;
revoke all on function public.academy_owner_id(uuid) from public, anon, authenticated;
revoke all on function public.notify_fee_due_change() from public, anon, authenticated;
revoke all on function public.notify_attendance_submitted() from public, anon, authenticated;
revoke all on function public.notify_membership_change() from public, anon, authenticated;
revoke all on function public.notify_guardian_invite_accepted() from public, anon, authenticated;
revoke all on function public.dispatch_push() from public, anon, authenticated;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
