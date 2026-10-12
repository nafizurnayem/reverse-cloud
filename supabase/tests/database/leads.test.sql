-- leads.test.sql
-- Automatic tests for migration 0012_leads_outbox.sql (leads, outbox, create_contact_lead).
-- Everything runs inside one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

-- ============================================================ test data
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'lead-admin@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'lead-pm@test.local'),
  ('00000000-0000-0000-0000-0000000000b3', 'lead-dev@test.local');

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000b1', id from public.roles where key = 'admin';
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000b2', id from public.roles where key = 'project_manager';
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000b3', id from public.roles where key = 'developer';

insert into public.leads (source, name, email, consent_at) values
  ('contact_form', 'Form visitor', 'visitor@example.com', now());
insert into public.leads (source, name, phone) values
  ('manual', 'Phone caller', '+8801700000000');

-- ===================================================== structure and rules
select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public' and rowsecurity
      and tablename in ('leads', 'notifications_outbox')),
  2, 'row level security is on for leads and the outbox');

select throws_ok(
  $$ insert into public.leads (source, name) values ('manual', 'No contact') $$,
  '23514', null, 'a lead needs an email or a phone number');

select throws_ok(
  $$ insert into public.leads (source, name, email, phone)
     values ('manual', 'Blank contact', '', '   ') $$,
  '23514', null, 'blank contact details do not count');

select throws_ok(
  $$ insert into public.leads (source, name, email, message)
     values ('manual', 'Long message', 'long@example.com', repeat('x', 5001)) $$,
  '23514', null, 'a message cannot be longer than 5000 characters');

select throws_ok(
  $$ insert into public.leads (source, name, email, status)
     values ('manual', 'Odd status', 'odd@example.com', 'weird') $$,
  '23514', null, 'a lead status must be a known one');

select throws_ok(
  $$ insert into public.leads (source, name, email) values ('chat', 'Chat visitor', 'chat@example.com') $$,
  '23514', null, 'a chat lead needs consent');

select throws_ok(
  $$ insert into public.leads (source, name, email) values ('contact_form', 'Form visitor 2', 'form2@example.com') $$,
  '23514', null, 'a contact form lead needs consent');

select throws_ok(
  $$ insert into public.leads (source, name, email) values ('handoff', 'Handoff visitor', 'hand@example.com') $$,
  '23514', null, 'a handoff lead needs consent');

select throws_ok(
  $$ insert into public.leads (source, name, email) values ('manual', 'A', 'short@example.com') $$,
  '23514', null, 'a name must be at least 2 characters');

select fk_ok('public', 'estimates', 'lead_id', 'public', 'leads', 'id',
  'estimates point to leads');

-- ================================================= a visitor (not signed in)
set local role anon;

select throws_ok(
  $$ select count(*) from public.leads $$,
  '42501', null, 'visitor cannot read leads');
select throws_ok(
  $$ insert into public.leads (source, name, email, consent_at)
     values ('contact_form', 'Direct insert', 'direct@example.com', now()) $$,
  '42501', null, 'visitor cannot insert a lead directly');
select throws_ok(
  $$ select count(*) from public.notifications_outbox $$,
  '42501', null, 'visitor cannot touch the outbox');

-- ================================================================ a developer
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.leads), 0,
  'a developer cannot see any leads');
select throws_ok(
  $$ insert into public.leads (source, name, phone) values ('manual', 'Dev lead', '+880111') $$,
  '42501', null, 'a developer cannot add a lead');

-- ====================================================== a project manager
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.leads), 2,
  'a project manager can read leads');
select lives_ok(
  $$ update public.leads set status = 'contacted' where source = 'contact_form' $$,
  'a project manager can change a lead status');
select is(
  (select status from public.leads where source = 'contact_form'),
  'contacted', 'the status change was saved');
select lives_ok(
  $$ update public.leads set assigned_to = '00000000-0000-0000-0000-0000000000b2'
     where source = 'contact_form' $$,
  'a project manager can assign a lead');
select throws_ok(
  $$ update public.leads set name = 'Renamed lead' where source = 'contact_form' $$,
  '42501', null, 'staff cannot edit anything except status and assignee');
select throws_ok(
  $$ insert into public.leads (source, name, phone) values ('manual', 'Walk-in', '+8801800000000') $$,
  '42501', null, 'staff cannot insert leads from the browser');
select throws_ok(
  $$ delete from public.leads where source = 'manual' $$,
  '42501', null, 'nobody can delete a lead');
select throws_ok(
  $$ select count(*) from public.notifications_outbox $$,
  '42501', null, 'a project manager cannot touch the outbox');

-- ================================================================ an admin
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.leads), 2,
  'admin sees all leads');
select throws_ok(
  $$ select count(*) from public.notifications_outbox $$,
  '42501', null, 'even an admin cannot touch the outbox from the app');
select is(
  (select count(*)::int from public.audit_log where entity_type = 'leads'),
  0, 'leads are not copied into the audit log');

-- ============================================== create_contact_lead function
reset role;
set local role anon;
select throws_ok(
  $$ select public.create_contact_lead('Web visitor', 'web@example.com', null, null, null,
       'en', 'Hello there', null, '{}'::jsonb, 'staff@example.com', '12345') $$,
  '42501', null, 'a visitor cannot run create_contact_lead');

reset role;
set local role authenticated;
select throws_ok(
  $$ select public.create_contact_lead('Web visitor', 'web@example.com', null, null, null,
       'en', 'Hello there', null, '{}'::jsonb, 'staff@example.com', '12345') $$,
  '42501', null, 'a signed-in user cannot run create_contact_lead');

reset role;
set local role service_role;
select lives_ok(
  $$ select public.create_contact_lead('Web visitor', 'web@example.com', null, null, null,
       'en', 'Hello there', null, '{}'::jsonb, 'staff@example.com', '12345') $$,
  'the service role can run create_contact_lead');

reset role;
select is(
  (select count(*)::int from public.leads where name = 'Web visitor'),
  1, 'the function saved one lead');
select is(
  (select consent_at is not null from public.leads where name = 'Web visitor'),
  true, 'the function recorded consent');
select is(
  (select count(*)::int from public.notifications_outbox
    where payload ->> 'name' = 'Web visitor'),
  2, 'the function queued two notifications');
select is(
  (select count(distinct channel)::int from public.notifications_outbox
    where payload ->> 'name' = 'Web visitor'),
  2, 'one notification is email and one is Telegram');

set local role service_role;
select throws_ok(
  $$ select public.create_contact_lead('Bad locale', 'bad@example.com', null, null, null,
       'fr', 'Hello', null, '{}'::jsonb, 'staff@example.com', '12345') $$,
  '23514', null, 'the function rejects an unknown language');
select throws_ok(
  $$ select public.create_contact_lead('No contact', '', '', null, null,
       'en', 'Hello', null, '{}'::jsonb, 'staff@example.com', '12345') $$,
  '23514', null, 'the function rejects a lead with no contact method');

-- ================================================================== done
reset role;
select * from finish();
rollback;