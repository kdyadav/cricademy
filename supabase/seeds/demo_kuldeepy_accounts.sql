-- Coach and guardian logins for the academy owned by kuldeepy@sensehawk.com. Run in the Supabase SQL editor
-- after demo_kuldeepy.sql. Every account uses the password below and must change it at first sign-in.
-- Safe to re-run: existing accounts are reused (their password is left unchanged) and existing links are kept.
create or replace function pg_temp.demo_user(p_username text, p_name text, p_password text)
returns uuid
language plpgsql
as $f$
declare
  v_id uuid;
  v_email text := p_username || '@users.cricademy.app';
begin
  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is not null then
    return v_id;
  end if;
  v_id := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                             'username', p_username, 'must_change_password', true),
          jsonb_build_object('display_name', p_name), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  return v_id;
end
$f$;

do $$
declare
  v_password constant text := 'Cricademy@2026';
  v_owner uuid;
  v_academy uuid;
  v_user uuid;
  r record;
begin
  select id into v_owner from auth.users where lower(email) = 'kuldeepy@sensehawk.com';
  select id into v_academy from public.academies where owner_id = v_owner order by created_at limit 1;
  if v_academy is null then
    raise exception 'kuldeepy@sensehawk.com does not own an academy';
  end if;
  if not exists (select 1 from public.net_batches where academy_id = v_academy and label = 'Morning Juniors') then
    raise exception 'Run demo_kuldeepy.sql first';
  end if;
  -- Coaches, each assigned to one or two batches.
  for r in
    select * from (values
      ('rahul.coach', 'Rahul Deshmukh', array['Morning Juniors', 'Weekend Spin Clinic']),
      ('priya.coach', 'Priya Menon', array['Evening U-16']),
      ('sameer.coach', 'Sameer Qureshi', array['U-19 Elite', 'Evening U-16'])
    ) as x(username, name, batches)
  loop
    v_user := pg_temp.demo_user(r.username, r.name, v_password);
    insert into public.academy_members (academy_id, user_id, role, status, invited_by)
    values (v_academy, v_user, 'coach', 'active', v_owner)
    on conflict (academy_id, user_id) do nothing;
    insert into public.batch_coaches (batch_id, coach_id)
    select b.id, v_user from public.net_batches b where b.academy_id = v_academy and b.label = any (r.batches)
    on conflict (batch_id, coach_id) do nothing;
  end loop;

  -- Guardians linked to one cadet each. The last two are pending: they must accept in the app.
  for r in
    select * from (values
      ('Aarav Sharma', 'sunita.sharma', 'Sunita Sharma', 'Mother', '+91 98201 44517', 'active'),
      ('Vihaan Patel', 'nilesh.patel', 'Nilesh Patel', 'Father', '+91 98250 31876', 'active'),
      ('Kabir Singh', 'harpreet.singh', 'Harpreet Singh', 'Father', '+91 98140 72093', 'active'),
      ('Reyansh Gupta', 'pooja.gupta', 'Pooja Gupta', 'Mother', '+91 99300 58124', 'active'),
      ('Dhruv Kulkarni', 'anand.kulkarni', 'Anand Kulkarni', 'Father', '+91 98220 16340', 'active'),
      ('Aditya Verma', 'kavita.verma', 'Kavita Verma', 'Mother', '+91 98110 93571', 'active'),
      ('Ayaan Khan', 'imran.khan', 'Imran Khan', 'Father', '+91 98330 27468', 'active'),
      ('Atharv Deshpande', 'madhuri.deshpande', 'Madhuri Deshpande', 'Mother', '+91 98810 64205', 'active'),
      ('Parth Iyer', 'lakshmi.iyer', 'Lakshmi Iyer', 'Mother', '+91 98400 81937', 'active'),
      ('Rohan Chauhan', 'vikram.chauhan', 'Vikram Chauhan', 'Father', '+91 98290 45612', 'active'),
      ('Siddharth Rao', 'meena.rao', 'Meena Rao', 'Mother', '+91 98450 70384', 'active'),
      ('Tanmay Saxena', 'ankit.saxena', 'Ankit Saxena', 'Sibling', '+91 99580 12749', 'active'),
      ('Om Prakash', 'ramesh.prakash', 'Ramesh Prakash', 'Guardian', '+91 98390 56021', 'active'),
      ('Ananya Das', 'rina.das', 'Rina Das', 'Mother', '+91 98300 69152', 'active'),
      ('Meera Jain', 'sanjay.jain', 'Sanjay Jain', 'Father', '+91 98920 38467', 'pending'),
      ('Kiara Sethi', 'neha.sethi', 'Neha Sethi', 'Mother', '+91 98100 27593', 'pending')
    ) as x(cadet, username, name, relationship, contact, status)
  loop
    v_user := pg_temp.demo_user(r.username, r.name, v_password);
    insert into public.academy_members (academy_id, user_id, role, status, invited_by)
    values (v_academy, v_user, 'guardian', r.status, v_owner)
    on conflict (academy_id, user_id) do nothing;
    insert into public.cadet_guardians (cadet_id, guardian_id, relationship)
    select c.id, v_user, r.relationship from public.cadets c where c.academy_id = v_academy and c.name = r.cadet
    on conflict (cadet_id, guardian_id) do nothing;
    update public.cadets
    set guardian_user_id = v_user,
        link_status = case when r.status = 'active' then 'linked' else 'pending' end,
        invite_expires_at = null,
        guardian = jsonb_build_object(
          'name', r.name,
          'contact', r.contact,
          'relationship', r.relationship,
          'permissions', case when r.relationship = 'Sibling' then '["view_only"]'::jsonb
                              else '["fee_payer", "attendance_signoff"]'::jsonb end,
          'verified', r.status = 'active',
          'username', r.username)
    where academy_id = v_academy and name = r.cadet;
  end loop;
end
$$;
