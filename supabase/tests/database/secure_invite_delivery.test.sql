-- secure_invite_delivery.test.sql
-- Tests for migration 0022_secure_invite_delivery.sql: verifying secure invitation
-- email delivery when p_send_email is true or false.

begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Setup test data
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000e1', 'pm-invite@test.local', now()),
  ('00000000-0000-0000-0000-0000000000e2', 'dev-invite@test.local', now());

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000e1', id from public.roles where key = 'project_manager';

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000e2', id from public.roles where key = 'developer';

insert into public.clients (id, full_name, email, preferred_locale) values
  ('00000000-0000-0000-0000-00000000c001', 'Test Client One', 'invitee1@example.com', 'en'),
  ('00000000-0000-0000-0000-00000000c002', 'Test Client Two', 'invitee2@example.com', 'bn');

-- 1. Unauthenticated or non-staff cannot create invites
set local role anon;
select throws_ok(
  $$ select * from public.create_client_invite('00000000-0000-0000-0000-00000000c001', 'invitee1@example.com', true) $$,
  '42501', null, 'anonymous visitor cannot create invite');

reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
end $$;

select throws_ok(
  $$ select * from public.create_client_invite('00000000-0000-0000-0000-00000000c001', 'invitee1@example.com', true) $$,
  '42501', null, 'developer without clients.manage cannot create invite');

-- 2. Staff member creates invite with p_send_email: false
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
end $$;

select set_config('rc.res_no_email', (
  select token from public.create_client_invite('00000000-0000-0000-0000-00000000c001', 'invitee1@example.com', false)
), true);

select is(length(current_setting('rc.res_no_email')), 43, 'token generated when p_send_email is false');

reset role;
select is(
  (select count(*)::int from public.notifications_outbox where to_address = 'invitee1@example.com'),
  0, 'no outbox notification queued when p_send_email is false');

-- 3. Staff member creates invite with p_send_email: true
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
end $$;

select set_config('rc.res_with_email', (
  select token from public.create_client_invite('00000000-0000-0000-0000-00000000c002', 'invitee2@example.com', true)
), true);

select is(length(current_setting('rc.res_with_email')), 43, 'token generated when p_send_email is true');

reset role;
select is(
  (select count(*)::int from public.notifications_outbox
    where to_address = 'invitee2@example.com' and template = 'client_invite'),
  1, 'outbox notification successfully queued when p_send_email is true');

select is(
  (select status from public.notifications_outbox
    where to_address = 'invitee2@example.com' and template = 'client_invite'),
  'pending', 'outbox row is in pending status');

select is(
  (select channel from public.notifications_outbox
    where to_address = 'invitee2@example.com' and template = 'client_invite'),
  'email', 'outbox row has channel email');

select is(
  (select (payload ->> 'client_id')::uuid from public.notifications_outbox
    where to_address = 'invitee2@example.com' and template = 'client_invite'),
  '00000000-0000-0000-0000-00000000c002'::uuid, 'payload contains correct client_id');

select is(
  (select (payload ? 'token') from public.notifications_outbox
    where to_address = 'invitee2@example.com' and template = 'client_invite'),
  false, 'payload never contains raw token');

select is(
  (select payload ->> 'locale' from public.notifications_outbox
    where to_address = 'invitee2@example.com' and template = 'client_invite'),
  'bn', 'payload contains client preferred locale');

select is(
  (select payload ->> 'client_name' from public.notifications_outbox
    where to_address = 'invitee2@example.com' and template = 'client_invite'),
  'Test Client Two', 'payload contains client full name');

select * from finish();
rollback;
