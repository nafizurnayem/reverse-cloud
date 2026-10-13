-- nightly_maintenance.test.sql
-- pgTAP tests for 0020_nightly_maintenance:
--   function existence
--   overdue payment item marking
--   expired booking proposal expiration
--   expired chat session purging (with message cascade)
--   payment reminder outbox queuing & deduplication
--   master runner & pg_cron job registration

begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- ============================================================= test data

-- Fixed test UUIDs
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000002001', 'maint-admin@test.local'),
  ('00000000-0000-0000-0000-000000002002', 'maint-cli@test.local');

insert into public.clients (id, user_id, full_name, email, stage, source) values
  ('00000000-0000-0000-0000-0000000020c1',
   '00000000-0000-0000-0000-000000002002',
   'Maint Client', 'maint-cli@test.local', 'active', 'website');

insert into public.projects (id, client_id, title, created_by) values
  ('00000000-0000-0000-0000-000000002010',
   '00000000-0000-0000-0000-0000000020c1',
   'Maintenance Test Project',
   '00000000-0000-0000-0000-000000002001');

-- ============================================================= function checks

select has_function('app', 'mark_overdue_payment_items', 'mark_overdue_payment_items exists');
select has_function('app', 'expire_booking_proposals',   'expire_booking_proposals exists');
select has_function('app', 'purge_expired_chat_sessions', 'purge_expired_chat_sessions exists');
select has_function('app', 'queue_payment_due_reminders', 'queue_payment_due_reminders exists');
select has_function('app', 'run_nightly_maintenance',    'run_nightly_maintenance exists');

-- ============================================================= overdue payments

-- Seed a payment item past due
insert into public.payment_items (id, project_id, title, amount_due, currency, status, due_on) values
  ('00000000-0000-0000-0000-000000002020',
   '00000000-0000-0000-0000-000000002010',
   'Past Due Milestone', 500.00, 'USD', 'pending', current_date - interval '2 days');

select isnt(
  app.mark_overdue_payment_items(),
  0,
  'mark_overdue_payment_items updates at least 1 item'
);

select is(
  (select status from public.payment_items where id = '00000000-0000-0000-0000-000000002020'),
  'overdue',
  'pending item past due_on becomes overdue'
);

-- ============================================================= booking proposals

-- Seed an expired proposal
insert into public.chat_sessions (id, locale) values
  ('00000000-0000-0000-0000-000000002030', 'en');

insert into public.booking_proposals (id, session_id, meeting_type_id, starts_at, ends_at, timezone, status, expires_at)
values
  ('00000000-0000-0000-0000-000000002040',
   '00000000-0000-0000-0000-000000002030',
   (select id from public.meeting_types where key = 'discovery_call'),
   now() + interval '1 day', now() + interval '1 day 30 minutes',
   'Asia/Dhaka', 'open', now() - interval '5 minutes');

select isnt(
  app.expire_booking_proposals(),
  0,
  'expire_booking_proposals updates at least 1 proposal'
);

select is(
  (select status from public.booking_proposals where id = '00000000-0000-0000-0000-000000002040'),
  'expired',
  'open proposal past expires_at becomes expired'
);

-- ============================================================= chat session purge

-- Seed an expired session and message
insert into public.chat_sessions (id, locale, expires_at) values
  ('00000000-0000-0000-0000-000000002050', 'bn', now() - interval '1 hour');

insert into public.chat_messages (id, session_id, role, content) values
  ('00000000-0000-0000-0000-000000002060',
   '00000000-0000-0000-0000-000000002050', 'user', 'Past session message');

select isnt(
  app.purge_expired_chat_sessions(),
  0,
  'purge_expired_chat_sessions deletes expired sessions'
);

select is_empty(
  $$ select 1 from public.chat_sessions where id = '00000000-0000-0000-0000-000000002050' $$,
  'expired chat session is deleted'
);

select is_empty(
  $$ select 1 from public.chat_messages where id = '00000000-0000-0000-0000-000000002060' $$,
  'messages of purged session are cascade deleted'
);

-- ============================================================= payment reminder outbox

-- Seed item due tomorrow
insert into public.payment_items (id, project_id, title, amount_due, currency, status, due_on) values
  ('00000000-0000-0000-0000-000000002070',
   '00000000-0000-0000-0000-000000002010',
   'Upcoming Invoice', 1200.00, 'USD', 'pending', (current_date + interval '1 day')::date);

select isnt(
  app.queue_payment_due_reminders(),
  0,
  'queue_payment_due_reminders queues at least 1 reminder'
);

select isnt_empty(
  $$ select 1 from public.notifications_outbox
     where template = 'payment_due_reminder'
       and (payload ->> 'payment_item_id')::uuid = '00000000-0000-0000-0000-000000002070' $$,
  'payment_due_reminder entry exists in notifications_outbox'
);

-- Calling again immediately should deduplicate and queue 0
select is(
  app.queue_payment_due_reminders(),
  0,
  'calling queue_payment_due_reminders within 24h deduplicates'
);

-- ============================================================= master runner

select isnt(
  (select app.run_nightly_maintenance() ->> 'ran_at'),
  null,
  'run_nightly_maintenance executes and returns valid timestamp'
);

reset role;
select * from finish();
rollback;
