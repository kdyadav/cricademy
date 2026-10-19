-- Demo data for the academy owned by kuldeepy@sensehawk.com. Run once in the Supabase SQL editor.
-- Adds 4 batches, 32 cadets, ~4 weeks of submitted registers, net sessions and 3 months of fees.
-- Dates are relative to the day it runs. Re-running is blocked once the demo batches exist.
do $$
declare
  v_owner uuid;
  v_academy uuid;
begin
  select id into v_owner from auth.users where lower(email) = 'kuldeepy@sensehawk.com';
  if v_owner is null then
    raise exception 'No user with email kuldeepy@sensehawk.com';
  end if;
  select id into v_academy from public.academies where owner_id = v_owner order by created_at limit 1;
  if v_academy is null then
    raise exception 'kuldeepy@sensehawk.com does not own an academy';
  end if;
  if exists (select 1 from public.net_batches where academy_id = v_academy and label = 'Morning Juniors') then
    raise exception 'Demo data is already in this academy';
  end if;

  perform setseed(0.42);

  insert into public.net_batches (academy_id, coach_id, label, age_group, focus, start_time, end_time, pitch)
  values
    (v_academy, v_owner, 'Morning Juniors', 'U-14', 'Front-foot drives', '06:30', '08:00', 'Turf 1'),
    (v_academy, v_owner, 'Evening U-16', 'U-16', 'Match simulation', '16:30', '18:30', 'Turf 2'),
    (v_academy, v_owner, 'U-19 Elite', 'U-19', 'Yorker accuracy', '17:00', '19:30', 'Astro nets'),
    (v_academy, v_owner, 'Weekend Spin Clinic', 'U-16', 'Spin variations', '07:00', '09:00', 'Turf 3');

  insert into public.batch_coaches (batch_id, coach_id)
  select id, v_owner from public.net_batches where academy_id = v_academy
  on conflict do nothing;

  insert into public.cadets (academy_id, coach_id, batch_id, name, jersey, age_group, role, batting_hand, bowling_style, created_at)
  select v_academy, v_owner, b.id, x.name, x.jersey, b.age_group, x.role, x.hand, x.bowling,
         now() - make_interval(days => 20 + x.jersey % 140)
  from (values
    ('Morning Juniors', 'Aarav Sharma', 7, 'Batter', 'Right', null),
    ('Morning Juniors', 'Vihaan Patel', 11, 'All-Rounder', 'Right', 'Right-arm medium'),
    ('Morning Juniors', 'Ishaan Reddy', 14, 'Bowler', 'Right', 'Right-arm fast-medium'),
    ('Morning Juniors', 'Kabir Singh', 18, 'Wicketkeeper', 'Right', null),
    ('Morning Juniors', 'Reyansh Gupta', 21, 'Batter', 'Left', null),
    ('Morning Juniors', 'Arjun Nair', 23, 'Bowler', 'Left', 'Slow left-arm orthodox'),
    ('Morning Juniors', 'Advik Joshi', 27, 'All-Rounder', 'Right', 'Right-arm off-break'),
    ('Morning Juniors', 'Dhruv Kulkarni', 31, 'Batter', 'Right', null),
    ('Evening U-16', 'Aditya Verma', 3, 'Batter', 'Right', null),
    ('Evening U-16', 'Krish Mehta', 9, 'Bowler', 'Right', 'Right-arm fast'),
    ('Evening U-16', 'Sai Krishnan', 12, 'All-Rounder', 'Left', 'Left-arm medium'),
    ('Evening U-16', 'Ayaan Khan', 17, 'Wicketkeeper', 'Right', null),
    ('Evening U-16', 'Rudra Pandey', 22, 'Batter', 'Left', null),
    ('Evening U-16', 'Atharv Deshpande', 33, 'Bowler', 'Right', 'Right-arm leg-break'),
    ('Evening U-16', 'Shaurya Yadav', 45, 'All-Rounder', 'Right', 'Right-arm medium-fast'),
    ('Evening U-16', 'Parth Iyer', 63, 'Batter', 'Right', null),
    ('U-19 Elite', 'Rohan Chauhan', 1, 'Batter', 'Right', null),
    ('U-19 Elite', 'Yash Thakur', 5, 'Bowler', 'Right', 'Right-arm fast'),
    ('U-19 Elite', 'Harsh Bhatia', 8, 'All-Rounder', 'Right', 'Right-arm off-break'),
    ('U-19 Elite', 'Siddharth Rao', 10, 'Wicketkeeper', 'Right', null),
    ('U-19 Elite', 'Tanmay Saxena', 19, 'Batter', 'Left', null),
    ('U-19 Elite', 'Nikhil Menon', 25, 'Bowler', 'Left', 'Left-arm fast-medium'),
    ('U-19 Elite', 'Varun Tiwari', 47, 'All-Rounder', 'Left', 'Slow left-arm orthodox'),
    ('U-19 Elite', 'Karan Malhotra', 77, 'Batter', 'Right', null),
    ('Weekend Spin Clinic', 'Om Prakash', 2, 'Bowler', 'Right', 'Right-arm off-break'),
    ('Weekend Spin Clinic', 'Laksh Agarwal', 6, 'Bowler', 'Right', 'Right-arm leg-break'),
    ('Weekend Spin Clinic', 'Pranav Bose', 13, 'All-Rounder', 'Left', 'Slow left-arm orthodox'),
    ('Weekend Spin Clinic', 'Dev Banerjee', 16, 'Batter', 'Right', null),
    ('Weekend Spin Clinic', 'Ritvik Pillai', 24, 'Bowler', 'Left', 'Left-arm wrist-spin'),
    ('Weekend Spin Clinic', 'Ananya Das', 28, 'All-Rounder', 'Right', 'Right-arm off-break'),
    ('Weekend Spin Clinic', 'Meera Jain', 35, 'Batter', 'Right', null),
    ('Weekend Spin Clinic', 'Kiara Sethi', 41, 'Wicketkeeper', 'Right', null)
  ) as x(batch, name, jersey, role, hand, bowling)
  join public.net_batches b on b.academy_id = v_academy and b.label = x.batch;

  -- Registers for the last 4 weeks: weekdays + Saturday, or weekends only for the clinic.
  insert into public.attendance_sheets (academy_id, coach_id, batch_id, date, records, submitted_at)
  select v_academy, v_owner, b.id, d::date,
    (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'cadetId', r.id,
        'status', r.status,
        'lateMinutes', case when r.status = 'late' then (array[5, 10, 15, 30])[1 + floor(r.r2 * 4)::int] end,
        'drillFocus', b.focus,
        'note', case r.status when 'injured' then 'Hamstring niggle, did mobility only'
                              when 'absent' then case when r.r2 < 0.5 then 'School exam' end end,
        'excusedByParent', case when r.status = 'absent' and r.r2 < 0.5 then true end
      )) order by r.jersey)
     from (
       select c.id, c.jersey, random() as r2,
         case when q.r < 0.80 then 'present' when q.r < 0.88 then 'late' when q.r < 0.97 then 'absent' else 'injured' end as status
       from public.cadets c
       cross join lateral (select random() + 0 * c.jersey + 0 * extract(epoch from d) as r) q
       where c.batch_id = b.id
     ) r),
    d::date + b.end_time::time + interval '10 minutes'
  from public.net_batches b
  cross join generate_series((current_date - 28)::timestamp, (current_date - 1)::timestamp, interval '1 day') d
  where b.academy_id = v_academy
    and case when b.label = 'Weekend Spin Clinic' then extract(isodow from d) in (6, 7) else extract(isodow from d) <> 7 end;

  -- Net sessions for batters, all-rounders and keepers: about two a week each.
  insert into public.net_sessions (academy_id, coach_id, cadet_id, batch_id, date, deliveries, saved_at)
  select v_academy, v_owner, s.cadet_id, s.batch_id, s.date,
    (select jsonb_agg(case
        when z.r < 0.04 then jsonb_build_object('runs', 0, 'zone', null, 'inControl', false,
          'dismissal', (array['Caught in field', 'Bowled', 'Caught behind', 'LBW', 'Run out'])[1 + floor(z.r2 * 5)::int])
        else jsonb_build_object(
          'runs', case when z.r < 0.42 then 0 when z.r < 0.70 then 1 when z.r < 0.80 then 2 when z.r < 0.82 then 3 when z.r < 0.96 then 4 else 6 end,
          'zone', case when z.r < 0.42 and z.r2 < 0.5 then null else (array['off', 'straight', 'leg'])[1 + floor(z.r3 * 3)::int] end,
          'inControl', z.r2 < s.skill)
      end order by z.n)
     from (select n, random() as r, random() as r2, random() as r3 from generate_series(1, s.balls) n) z),
    s.date + interval '19 hours'
  from (
    select c.id as cadet_id, c.batch_id, d::date as date,
      18 + floor(random() * 19)::int + 0 * c.jersey as balls,
      0.6 + (c.jersey % 7) * 0.05 as skill
    from public.cadets c
    cross join generate_series((current_date - 28)::timestamp, (current_date - 1)::timestamp, interval '1 day') d
    where c.academy_id = v_academy and c.role in ('Batter', 'All-Rounder', 'Wicketkeeper')
      and extract(isodow from d) in (2, 5)
  ) s;

  insert into public.fee_settings (academy_id, coach_id, upi_id, payee_name)
  values (v_academy, v_owner, 'kuldeep.cricademy@okhdfc', 'Kuldeep Cricket Academy')
  on conflict (academy_id) do nothing;

  -- Monthly fees (due on the 10th) for this month and the two before, plus a season kit fee for some cadets.
  insert into public.fee_dues (academy_id, coach_id, cadet_id, title, amount, due_date, status, paid_at, method,
                               reference, reported_reference, reported_at, reminded_at, created_at)
  select v_academy, v_owner, f.cadet_id, f.title, f.amount, f.due_date, f.status,
    case when f.status = 'paid' then least(now() - interval '1 hour', f.due_date + make_interval(days => floor(f.r2 * 12)::int - 6, hours => 10)) end,
    case when f.status = 'paid' then case when f.r3 < 0.7 then 'upi' when f.r3 < 0.95 then 'cash' else 'other' end end,
    case when f.status = 'paid' then case when f.r3 < 0.7 then lpad(floor(f.r2 * 1e12)::bigint::text, 12, '0')
                                          when f.r3 < 0.95 then 'Receipt ' || (1000 + floor(f.r3 * 9000)::int) else 'NEFT' end
         when f.status = 'waived' then 'Sibling concession' end,
    case when f.status = 'due' and f.reported then lpad(floor(f.r3 * 1e12)::bigint::text, 12, '0') end,
    case when f.status = 'due' and f.reported then now() - make_interval(hours => 2 + floor(f.r3 * 60)::int) end,
    case when f.status = 'due' and not f.reported and f.due_date < current_date then now() - interval '2 days' end,
    f.due_date - 20
  from (
    select c.id as cadet_id, dd.due_date, q.r2, q.r3,
      case when k.kit then 'Season kit' else to_char(dd.due_date, 'FMMonth YYYY') || ' fee' end as title,
      case when k.kit then 1800 else case c.age_group when 'U-14' then 2500 when 'U-16' then 3000 else 3500 end end as amount,
      case
        when k.kit then case when q.r < 0.85 then 'paid' else 'due' end
        when m = 2 then case when q.r < 0.04 then 'waived' else 'paid' end
        when m = 1 then case when q.r < 0.80 then 'paid' when q.r < 0.84 then 'waived' else 'due' end
        when dd.due_date > current_date then case when q.r < 0.35 then 'paid' else 'due' end
        else case when q.r < 0.60 then 'paid' else 'due' end
      end as status,
      m = 0 and q.r2 < 0.3 as reported
    from public.cadets c
    cross join generate_series(0, 3) m
    cross join lateral (select m = 3 as kit) k
    cross join lateral (
      select random() + 0 * c.jersey + 0 * m as r, random() + 0 * c.jersey + 0 * m as r2, random() + 0 * c.jersey + 0 * m as r3
    ) q
    cross join lateral (
      select case when k.kit then (date_trunc('month', current_date) - interval '1 month')::date + 14
                  else (date_trunc('month', current_date) - make_interval(months => m))::date + 9 end as due_date
    ) dd
    where c.academy_id = v_academy and (not k.kit or c.jersey % 5 < 2)
  ) f;
end
$$;
