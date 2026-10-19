-- One cadet's attendance across submitted registers. Guardians can't read `attendance_sheets` directly,
-- because each sheet holds the whole batch; this returns only the requested cadet's record.
create or replace function public.get_cadet_attendance(p_cadet_id uuid, p_limit integer default 30)
returns table (date date, batch_id uuid, status text, late_minutes integer, note text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.date, s.batch_id, r->>'status', (r->>'lateMinutes')::integer, r->>'note'
  from public.attendance_sheets s
  cross join lateral jsonb_array_elements(s.records) r
  where r->>'cadetId' = p_cadet_id::text
    and s.submitted_at is not null
    and (public.is_guardian_of(p_cadet_id) or public.can_manage_cadet(p_cadet_id))
  order by s.date desc
  limit greatest(1, least(p_limit, 365));
$$;

revoke all on function public.get_cadet_attendance(uuid, integer) from public, anon;
grant execute on function public.get_cadet_attendance(uuid, integer) to authenticated;
