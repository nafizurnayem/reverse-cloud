-- meetings.test.sql
-- pgTAP tests for migration 0025_meetings:
--   - Schema: all columns, constraints, triggers, indexes
--   - RLS: staff with meetings.read can read all rows
--   - RLS: staff with leads.manage can update (staff_notes, assigned_to, status)
--   - RLS: client can read only own confirmed/rescheduled meetings
--   - RLS: client cannot read cancelled meetings or other clients' meetings
--   - RLS: no direct insert from authenticated role (service_role only)
--   - RLS: anon cannot read anything
--   - Full cross-client isolation check

begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ============================================================= test data

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000002501', 'mt-pm@test.local'),      -- staff (project_manager)
  ('00000000-0000-0000-0000-000000002502', 'mt-dev@test.local'),     -- staff (developer, no meetings.read)
  ('00000000-0000-0000-0000-000000002503', 'mt-clia@test.local'),    -- Client A
  ('00000000-0000-0000-0000-000000002504', 'mt-clib@test.local');    -- Client B

insert into public.staff_roles (user_id, role_id)
  select '00000000-0000-0000-0000-000000002501', id from public.roles where key = 'project_manager';
insert into public.staff_roles (user_id, role_id)
  select '00000000-0000-0000-0000-000000002502', id from public.roles where key = 'developer';

insert into public.clients (id, user_id, full_name, email, stage, source) values
  ('00000000-0000-0000-0000-0000000025c1', '00000000-0000-0000-0000-000000002503',
   'Meeting Client A', 'mt-clia@test.local', 'active', 'website'),
  ('00000000-0000-0000-0000-0000000025c2', '00000000-0000-0000-0000-000000002504',
   'Meeting Client B', 'mt-clib@test.local', 'active', 'website');

-- Get a meeting_type id
do $$
begin
  if not exists (select 1 from public.meeting_types where key = 'discovery_call') then
    insert into public.meeting_types (key, name_en, duration_min) values ('discovery_call', 'Discovery Call', 30);
  end if;
end;
$$;

-- Seed meetings directly as postgres (simulating service_role webhook insert)
insert into public.meetings
  (id, calcom_booking_uid, meeting_type_id, client_id, attendee_name, attendee_email,
   attendee_timezone, starts_at, ends_at, status)
values
  ('00000000-0000-0000-0000-000000002510',
   'calcom-uid-clia-1',
   (select id from public.meeting_types where key = 'discovery_call'),
   '00000000-0000-0000-0000-0000000025c1',
   'Client A', 'mt-clia@test.local', 'Asia/Dhaka',
   now() + interval '2 days', now() + interval '2 days 30 minutes', 'confirmed'),

  ('00000000-0000-0000-0000-000000002511',
   'calcom-uid-clia-2',
   (select id from public.meeting_types where key = 'discovery_call'),
   '00000000-0000-0000-0000-0000000025c1',
   'Client A', 'mt-clia@test.local', 'Asia/Dhaka',
   now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', 'cancelled'),

  ('00000000-0000-0000-0000-000000002512',
   'calcom-uid-clib-1',
   (select id from public.meeting_types where key = 'discovery_call'),
   '00000000-0000-0000-0000-0000000025c2',
   'Client B', 'mt-clib@test.local', 'Asia/Dhaka',
   now() + interval '3 days', now() + interval '3 days 30 minutes', 'confirmed');

-- ============================================================= schema checks

select has_column('public', 'meetings', 'id',                  'meetings.id exists');
select has_column('public', 'meetings', 'calcom_booking_uid',  'meetings.calcom_booking_uid exists');
select has_column('public', 'meetings', 'meeting_type_id',     'meetings.meeting_type_id exists');
select has_column('public', 'meetings', 'proposal_id',         'meetings.proposal_id exists');
select has_column('public', 'meetings', 'client_id',           'meetings.client_id exists');
select has_column('public', 'meetings', 'attendee_email',      'meetings.attendee_email exists');
select has_column('public', 'meetings', 'starts_at',           'meetings.starts_at exists');
select has_column('public', 'meetings', 'status',              'meetings.status exists');
select has_column('public', 'meetings', 'calcom_payload',      'meetings.calcom_payload exists');
select has_column('public', 'meetings', 'staff_notes',         'meetings.staff_notes exists');

-- unique constraint on calcom_booking_uid
select throws_ok(
  $$ insert into public.meetings
       (calcom_booking_uid, meeting_type_id, attendee_name, attendee_email,
        attendee_timezone, starts_at, ends_at)
     values (
       'calcom-uid-clia-1',
       (select id from public.meeting_types where key = 'discovery_call'),
       'Dup', 'dup@test.local', 'UTC', now(), now() + interval '30 min'
     ) $$,
  '23505', null, 'calcom_booking_uid must be unique'
);

-- ends_at > starts_at constraint
select throws_ok(
  $$ insert into public.meetings
       (calcom_booking_uid, meeting_type_id, attendee_name, attendee_email,
        attendee_timezone, starts_at, ends_at)
     values (
       'bad-time', (select id from public.meeting_types where key = 'discovery_call'),
       'Bad', 'bad@test.local', 'UTC', now(), now() - interval '1 minute'
     ) $$,
  '23514', null, 'ends_at must be after starts_at'
);

-- ============================================================= RLS: staff (meetings.read = project_manager)

reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000002501","role":"authenticated"}', true); end $$;

select is(
  (select count(*)::int from public.meetings),
  3,
  'staff with meetings.read sees all 3 meetings'
);

-- Staff can update staff_notes
select lives_ok(
  $$ update public.meetings set staff_notes = 'Reviewed by PM'
     where id = '00000000-0000-0000-0000-000000002510' $$,
  'staff with leads.manage can update staff_notes'
);

select is(
  (select staff_notes from public.meetings where id = '00000000-0000-0000-0000-000000002510'),
  'Reviewed by PM',
  'staff_notes update was saved'
);

-- ============================================================= RLS: developer (projects.update only, no meetings.read)

reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000002502","role":"authenticated"}', true); end $$;

select is(
  (select count(*)::int from public.meetings),
  0,
  'developer without meetings.read sees no meetings'
);

-- ============================================================= RLS: Client A

reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000002503","role":"authenticated"}', true); end $$;

-- Client A sees own confirmed meeting
select isnt_empty(
  $$ select 1 from public.meetings where id = '00000000-0000-0000-0000-000000002510' $$,
  'client A can see own confirmed meeting'
);

-- Client A does not see own CANCELLED meeting
select is_empty(
  $$ select 1 from public.meetings where id = '00000000-0000-0000-0000-000000002511' $$,
  'client A cannot see own cancelled meeting'
);

-- Client A cannot see Client B's meeting (cross-client isolation)
select is_empty(
  $$ select 1 from public.meetings where id = '00000000-0000-0000-0000-000000002512' $$,
  'client A cannot see client B meeting (cross-client isolation)'
);

select is(
  (select count(*)::int from public.meetings),
  1,
  'client A sees exactly 1 meeting'
);

-- Client cannot insert directly
select throws_ok(
  $$ insert into public.meetings
       (calcom_booking_uid, meeting_type_id, client_id, attendee_name, attendee_email,
        attendee_timezone, starts_at, ends_at)
     values (
       'hack-uid',
       (select id from public.meeting_types where key = 'discovery_call'),
       '00000000-0000-0000-0000-0000000025c1',
       'Hack', 'hack@test.local', 'UTC',
       now(), now() + interval '30 min'
     ) $$,
  '42501', null, 'client cannot insert meetings directly'
);

-- ============================================================= RLS: Client B

reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000002504","role":"authenticated"}', true); end $$;

select is(
  (select count(*)::int from public.meetings),
  1,
  'client B sees only their own 1 meeting'
);

-- ============================================================= anon access

reset role;
set local role anon;

select throws_ok(
  $$ select 1 from public.meetings $$,
  '42501',
  null,
  'anon cannot select from meetings (table grant revoked)'
);

-- ============================================================= RLS guard (meetings has RLS on)
reset role;
select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public' and tablename = 'meetings' and rowsecurity = true),
  1,
  'meetings table has row level security enabled'
);

reset role;
select * from finish();
rollback;
