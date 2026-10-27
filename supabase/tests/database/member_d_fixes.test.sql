-- member_d_fixes.test.sql
-- pgTAP test suite validating Member D database fixes:
-- FX-12, FX-18, FX-19, FX-05, FX-09, FX-06, FX-13, FX-03, FX-04

begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ------------------------------------------------------------- 1. Setup Test Users & Roles
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111101', 'staff-admin@test.local', now()),
  ('11111111-1111-1111-1111-111111111102', 'customer-a@test.local', now()),
  ('11111111-1111-1111-1111-111111111103', 'customer-b@test.local', now());

insert into public.profiles (id, full_name) values
  ('11111111-1111-1111-1111-111111111101', 'Staff Admin'),
  ('11111111-1111-1111-1111-111111111102', 'Customer Alice'),
  ('11111111-1111-1111-1111-111111111103', 'Customer Bob')
on conflict (id) do update set full_name = excluded.full_name;

-- Make user 1 an admin
insert into public.staff_roles (user_id, role_id, is_active)
select '11111111-1111-1111-1111-111111111101', r.id, true
  from public.roles r where r.key = 'admin';

-- Client records
insert into public.clients (id, user_id, full_name, email, stage, source) values
  ('11111111-1111-1111-1111-1111111111c1', '11111111-1111-1111-1111-111111111102', 'Alice Corp', 'customer-a@test.local', 'active', 'website'),
  ('11111111-1111-1111-1111-1111111111c2', '11111111-1111-1111-1111-111111111103', 'Bob Corp', 'customer-b@test.local', 'active', 'website');

-- Projects
insert into public.projects (id, client_id, title, created_by) values
  ('11111111-1111-1111-1111-1111111111p1', '11111111-1111-1111-1111-1111111111c1', 'Alice Project', '11111111-1111-1111-1111-111111111101'),
  ('11111111-1111-1111-1111-1111111111p2', '11111111-1111-1111-1111-1111111111c2', 'Bob Project', '11111111-1111-1111-1111-111111111101');

-- ------------------------------------------------------------- 2. FX-05: list_staff_directory & lookup
-- Run as admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111101","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.list_staff_directory() where user_id = '11111111-1111-1111-1111-111111111101'),
  1,
  'FX-05: Staff member is present in staff directory'
);

select is(
  (select count(*)::int from public.list_staff_directory() where user_id = '11111111-1111-1111-1111-111111111102'),
  0,
  'FX-05: Customer without staff role is omitted from staff directory'
);

select is(
  (select user_id from public.lookup_user_by_email('customer-a@test.local')),
  '11111111-1111-1111-1111-111111111102'::uuid,
  'FX-05: Admin can lookup user by exact email'
);

-- Run as customer: permission denied
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111102","role":"authenticated"}', true);
select throws_ok(
  'select * from public.list_staff_directory()',
  '42501',
  'permission_denied',
  'FX-05: Non-staff user cannot call list_staff_directory'
);

-- ------------------------------------------------------------- 3. FX-09: submit_project_review
-- Customer Alice reviews Alice Project
select lives_ok(
  $$select public.submit_project_review('11111111-1111-1111-1111-1111111111p1'::uuid, 5::smallint, 'Alice', 'CEO', 'Great team', 'en')$$,
  'FX-09: Project owner successfully submits review'
);

-- Review is pending and hidden from anon and public
set local role anon;
select is(
  (select count(*)::int from public.reviews where project_id = '11111111-1111-1111-1111-1111111111p1'),
  0,
  'FX-09: Pending review is hidden from public / unmoderated reads'
);

-- Customer Bob tries to review Alice Project -> rejected
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111103","role":"authenticated"}', true);

select throws_ok(
  $$select public.submit_project_review('11111111-1111-1111-1111-1111111111p1'::uuid, 5::smallint, 'Bob', null, 'Intruder review', 'en')$$,
  '42501',
  'project_not_found_or_forbidden',
  'FX-09: Non-owner client cannot review another client project'
);

-- ------------------------------------------------------------- 4. FX-06: confirm_booking_proposal
-- Seed meeting type & chat session for Alice
reset role;
insert into public.chat_sessions (id, user_id, client_id, status) values
  ('11111111-1111-1111-1111-1111111111s1', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-1111111111c1', 'active');

insert into public.booking_proposals (id, session_id, meeting_type_id, starts_at, ends_at, timezone, status, expires_at)
select '11111111-1111-1111-1111-1111111111b1', '11111111-1111-1111-1111-1111111111s1', mt.id, now() + interval '1 day', now() + interval '1 day 30 min', 'UTC', 'open', now() + interval '15 min'
  from public.meeting_types mt where mt.key = 'discovery_call';

-- Customer Bob tries to confirm Alice proposal -> rejected
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111103","role":"authenticated"}', true);
select throws_ok(
  $$select public.confirm_booking_proposal('11111111-1111-1111-1111-1111111111b1'::uuid)$$,
  '42501',
  'forbidden',
  'FX-06: Stranger cannot confirm proposal belonging to another session'
);

-- Customer Alice confirms her proposal -> succeeds
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111102","role":"authenticated"}', true);
select lives_ok(
  $$select public.confirm_booking_proposal('11111111-1111-1111-1111-1111111111b1'::uuid)$$,
  'FX-06: Owner successfully confirms booking proposal'
);

-- A second confirm call fails (cannot confirm already-confirmed proposal)
select throws_ok(
  $$select public.confirm_booking_proposal('11111111-1111-1111-1111-1111111111b1'::uuid)$$,
  '22023',
  'proposal_not_open',
  'FX-06: Cannot confirm a proposal twice'
);

-- ------------------------------------------------------------- 5. FX-12: Robust Nightly Maintenance
reset role;
-- Insert a malformed outbox row with non-uuid payment_item_id
insert into public.notifications_outbox (channel, to_address, template, payload) values
  ('email', 'bad@test.local', 'payment_due_reminder', '{"payment_item_id": "malformed-not-a-uuid"}'::jsonb);

-- Insert an overdue payment item
insert into public.payment_items (id, project_id, title, amount_due, currency, status, due_on) values
  ('11111111-1111-1111-1111-1111111111i1', '11111111-1111-1111-1111-1111111111p1', 'Overdue Milestone', 1000.00, 'USD', 'pending', current_date - interval '3 days');

-- Run maintenance
select lives_ok(
  'select app.run_nightly_maintenance()',
  'FX-12: run_nightly_maintenance survives malformed outbox row'
);

select is(
  (select status from public.payment_items where id = '11111111-1111-1111-1111-1111111111i1'),
  'overdue',
  'FX-12: Overdue items are successfully updated despite bad outbox payload'
);

-- ------------------------------------------------------------- 6. FX-13: create_chat_lead
-- Execute as service_role / ai_service
set local role service_role;
select lives_ok(
  $$select public.create_chat_lead('Prospect Charlie', 'charlie@test.local', '+123456789', 'Charlie Co', 'US', 'en', 'Interested in cloud migration')$$,
  'FX-13: create_chat_lead succeeds'
);

select is(
  (select count(*)::int from public.notifications_outbox where payload->>'email' = 'charlie@test.local'),
  2,
  'FX-13: Exactly two notifications (email + telegram) queued in outbox for chat lead'
);

-- ------------------------------------------------------------- 7. FX-04: Outbox payload never contains token
select is(
  (select count(*)::int from public.notifications_outbox where payload ? 'token'),
  0,
  'FX-04: No notifications_outbox rows contain raw token'
);

-- ------------------------------------------------------------- 8. FX-03: Cross-client isolation
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111102","role":"authenticated"}', true);

select throws_ok(
  $$select app.get_client_project_status('11111111-1111-1111-1111-1111111111c2'::uuid)$$,
  '42501',
  'FX-03: Ordinary client cannot query project status of another client'
);

-- ------------------------------------------------------------- 9. FX-19: guard_client_self_update
select throws_ok(
  $$update public.clients set email = 'hacked@test.local' where id = '11111111-1111-1111-1111-1111111111c1'$$,
  '42501',
  'FX-19: Client cannot change protected columns'
);

-- ------------------------------------------------------------- 10. FX-18: accept_client_invite
reset role;
-- Seed an expired invite for Alice
insert into public.client_invites (id, client_id, email, token_hash, expires_at) values
  ('11111111-1111-1111-1111-1111111111v1', '11111111-1111-1111-1111-1111111111c1', 'customer-a@test.local', encode(extensions.digest('expired-token', 'sha256'), 'hex'), now() - interval '1 hour');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111102","role":"authenticated"}', true);

select throws_ok(
  $$select public.accept_client_invite('expired-token')$$,
  'invalid_or_expired_invite',
  'FX-18: Already linked user cannot accept expired invite'
);

-- Finish pgTAP tests
select * from finish();
rollback;
