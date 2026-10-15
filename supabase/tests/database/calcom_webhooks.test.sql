begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public.chat_sessions (id, locale) values ('00000000-0000-0000-0000-000000002601', 'en');
update public.meeting_types set calcom_event_type_id = '26001' where key = 'discovery_call';
insert into public.booking_proposals (id, session_id, meeting_type_id, starts_at, ends_at, timezone)
select '00000000-0000-0000-0000-000000002602', '00000000-0000-0000-0000-000000002601', id,
  '2026-11-01 10:00:00+00', '2026-11-01 10:30:00+00', 'UTC'
from public.meeting_types where key = 'discovery_call';

select has_table('public', 'calcom_webhook_deliveries', 'delivery ledger exists');
select has_column('public', 'meetings', 'last_calcom_event_at', 'meetings track event ordering');
select has_function('public', 'process_calcom_webhook_delivery',
  array['text','text','timestamp with time zone','text','text','text','text','uuid','text','text','text','timestamp with time zone','timestamp with time zone'],
  'atomic webhook RPC exists');

set local role service_role;
select ok(public.process_calcom_webhook_delivery(
  repeat('a',64), 'BOOKING_CONFIRMED', '2026-10-15 12:00:00+00', 'booking-2601', repeat('b',64),
  '26001', 'discovery-call', '00000000-0000-0000-0000-000000002602',
  'Test Attendee', 'attendee@test.local', 'Asia/Dhaka', '2026-11-02 10:00:00+00', '2026-11-02 10:30:00+00'
), 'first delivery is processed');
reset role;

select is((select count(*)::integer from public.meetings where calcom_booking_uid = 'booking-2601'), 1, 'meeting is created once');
select is((select status from public.meetings where calcom_booking_uid = 'booking-2601'), 'confirmed', 'meeting is confirmed');
select is((select status from public.booking_proposals where id = '00000000-0000-0000-0000-000000002602'), 'confirmed', 'proposal is confirmed');
select is((select calcom_payload from public.meetings where calcom_booking_uid = 'booking-2601'), null::jsonb, 'raw Cal.com payload is not retained');

set local role service_role;
select ok(not public.process_calcom_webhook_delivery(
  repeat('a',64), 'BOOKING_CONFIRMED', '2026-10-15 12:00:00+00', 'booking-2601', repeat('b',64),
  '26001', null, null, 'Test Attendee', 'attendee@test.local', 'UTC',
  '2026-11-02 10:00:00+00', '2026-11-02 10:30:00+00'
), 'duplicate delivery is ignored');
reset role;
select is((select count(*)::integer from public.calcom_webhook_deliveries), 1, 'duplicate has one ledger row');

set local role service_role;
select ok(public.process_calcom_webhook_delivery(
  repeat('c',64), 'BOOKING_CANCELLED', '2026-10-15 13:00:00+00', 'booking-2601', repeat('d',64),
  null, null, null, null, null, null, null, null
), 'cancellation is processed');
reset role;
select is((select status from public.meetings where calcom_booking_uid = 'booking-2601'), 'cancelled', 'meeting is cancelled');

set local role service_role;
select ok(public.process_calcom_webhook_delivery(
  repeat('e',64), 'BOOKING_CONFIRMED', '2026-10-15 11:00:00+00', 'booking-2601', repeat('f',64),
  '26001', null, null, 'Test Attendee', 'attendee@test.local', 'UTC',
  '2026-11-02 10:00:00+00', '2026-11-02 10:30:00+00'
), 'older event is recorded');
reset role;
select is((select status from public.meetings where calcom_booking_uid = 'booking-2601'), 'cancelled', 'older event cannot overwrite newer state');
select is((select count(*)::integer from public.calcom_webhook_deliveries), 3, 'all unique deliveries are recorded');

set local role authenticated;
select throws_ok($$ select public.process_calcom_webhook_delivery(
  repeat('1',64), 'BOOKING_CANCELLED', now(), 'blocked', repeat('2',64), null, null, null, null, null, null, null, null
) $$, '42501', null, 'authenticated users cannot execute webhook RPC');

reset role;
select * from finish();
rollback;
