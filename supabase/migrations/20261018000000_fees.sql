-- Fee collection over UPI: the coach's payee details, dues raised per cadet, and RPCs for the
-- public pay page. `cadets.fee_due` becomes the sum of a cadet's open dues, kept in sync by trigger.

create table if not exists public.fee_settings (
  coach_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  upi_id      text not null check (char_length(upi_id) <= 100 and upi_id ~ '^[A-Za-z0-9._-]{2,}@[A-Za-z0-9]{2,}$'),
  payee_name  text not null check (char_length(payee_name) between 1 and 60),
  updated_at  timestamptz not null default now()
);

alter table public.fee_settings drop constraint if exists fee_settings_upi_id_check;
alter table public.fee_settings add constraint fee_settings_upi_id_check
  check (char_length(upi_id) <= 100 and upi_id ~ '^[A-Za-z0-9._-]{2,}@[A-Za-z0-9]{2,}$');

drop trigger if exists fee_settings_set_updated_at on public.fee_settings;
create trigger fee_settings_set_updated_at
  before update on public.fee_settings
  for each row execute function public.set_updated_at();

create table if not exists public.fee_dues (
  id                  uuid primary key default gen_random_uuid(),
  coach_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cadet_id            uuid not null references public.cadets (id) on delete cascade,
  title               text not null check (char_length(title) between 1 and 60),
  amount              numeric(10, 2) not null check (amount > 0),
  due_date            date not null,
  status              text not null default 'due' check (status in ('due', 'paid', 'waived')),
  paid_at             timestamptz,
  method              text check (method in ('upi', 'cash', 'other')),
  reference           text check (char_length(reference) <= 60),
  reported_reference  text check (char_length(reported_reference) <= 40),
  reported_at         timestamptz,
  reminded_at         timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists fee_dues_coach_idx on public.fee_dues (coach_id);
create index if not exists fee_dues_cadet_idx on public.fee_dues (cadet_id);

do $$
declare
  t text;
begin
  foreach t in array array['fee_settings', 'fee_dues'] loop
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

create or replace function public.sync_cadet_fee_due()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cadet uuid;
begin
  foreach v_cadet in array array[
    case when tg_op <> 'INSERT' then old.cadet_id end,
    case when tg_op <> 'DELETE' then new.cadet_id end
  ] loop
    continue when v_cadet is null;
    update public.cadets
    set fee_due = coalesce((select sum(d.amount) from public.fee_dues d where d.cadet_id = v_cadet and d.status = 'due'), 0)
    where id = v_cadet;
  end loop;
  return null;
end;
$$;

drop trigger if exists fee_dues_sync_cadet on public.fee_dues;
create trigger fee_dues_sync_cadet
  after insert or update of amount, status, cadet_id or delete on public.fee_dues
  for each row execute function public.sync_cadet_fee_due();

-- Amounts entered by hand before this migration become an opening-balance due.
insert into public.fee_dues (coach_id, cadet_id, title, amount, due_date)
select c.coach_id, c.id, 'Opening balance', c.fee_due, current_date
from public.cadets c
where c.fee_due > 0 and not exists (select 1 from public.fee_dues d where d.cadet_id = c.id);

-- Public pay page; reveals the due and payee only to someone holding the due's id.
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
  left join public.fee_settings s on s.coach_id = d.coach_id
  where d.id = p_due_id;
$$;

-- Lets the payer send their UPI transaction reference (UTR) for the coach to confirm.
create or replace function public.report_fee_payment(p_due_id uuid, p_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text := upper(regexp_replace(coalesce(p_reference, ''), '\s', '', 'g'));
begin
  if v_ref !~ '^[A-Z0-9]{6,40}$' then
    raise exception 'Enter the UPI transaction ID (UTR) from your payment app' using errcode = '22023';
  end if;
  update public.fee_dues
  set reported_reference = v_ref, reported_at = now()
  where id = p_due_id and status = 'due';
  if not found then
    raise exception 'This fee is no longer open for payment' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.sync_cadet_fee_due() from public, anon, authenticated;
revoke all on function public.get_fee_payment(uuid) from public;
revoke all on function public.report_fee_payment(uuid, text) from public;
grant execute on function public.get_fee_payment(uuid) to anon, authenticated;
grant execute on function public.report_fee_payment(uuid, text) to anon, authenticated;
