begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'lead-admin@test.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'visitor@test.local');

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000e1', id from public.roles where key = 'admin';

insert into public.leads (name, email, message, source, consent_at)
values ('Existing lead', 'existing@example.com', 'Hello', 'contact_form', now());

select is(
  (select count(*)::int from pg_tables
   where schemaname = 'public' and rowsecurity
     and tablename in ('leads', 'notifications_outbox')),
  2, 'RLS is enabled on leads and the notification outbox');

select throws_ok(
  $$ insert into public.leads (name, message, source, consent_at)
     values ('No contact', 'Hello', 'contact_form', now()) $$,
  '23514', null, 'a lead needs an email or phone');

select throws_ok(
  $$ insert into public.leads (name, email, message, source)
     values ('No consent', 'no-consent@example.com', 'Hello', 'contact_form') $$,
  '23514', null, 'a public form lead needs consent');

set local role anon;
select throws_ok(
  $$ select count(*)::int from public.leads $$,
  '42501', null, 'anonymous users cannot read leads');
select throws_ok(
  $$ insert into public.leads (name, email, message, source, consent_at)
     values ('Attacker', 'attacker@example.com', 'Hello', 'contact_form', now()) $$,
  '42501', null, 'anonymous users cannot insert leads directly');
select throws_ok(
  $$ select public.create_contact_lead('A', 'a@example.com', '', '', '', 'en',
       'Message', null, '{}'::jsonb, 'staff@example.com', '123') $$,
  '42501', null, 'anonymous users cannot call the privileged contact function');

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
select is((select count(*)::int from public.leads), 0, 'ordinary users cannot read leads');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from public.leads), 1, 'staff with lead access can read leads');
select lives_ok(
  $$ update public.leads set status = 'contacted' where name = 'Existing lead' $$,
  'staff with leads.manage can update a lead');
select is((select status from public.leads where name = 'Existing lead'), 'contacted',
  'the lead status update is saved');
select throws_ok(
  $$ insert into public.leads (name, email, message, source, consent_at)
     values ('Manual bypass', 'bypass@example.com', 'Hello', 'contact_form', now()) $$,
  '42501', null, 'staff cannot bypass the validated server route to insert leads');

reset role;
set local role service_role;
select isnt(
  public.create_contact_lead(
    'New lead', 'new@example.com', '', 'Acme', 'BD', 'bn', 'Need a website',
    null, '{"utm_source":"test"}'::jsonb, 'staff@example.com', '998877'
  ), null::uuid, 'the service role can create a contact lead atomically');
select is((select count(*)::int from public.leads where email = 'new@example.com'), 1,
  'the contact lead is stored');
select is((select count(*)::int from public.notifications_outbox), 2,
  'email and Telegram notifications are queued');
select set_eq(
  $$ select channel from public.notifications_outbox $$,
  array['email', 'telegram'], 'the two expected notification channels are queued');

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok(
  $$ select count(*)::int from public.notifications_outbox $$,
  '42501', null, 'the outbox is hidden even from administrators');

select * from finish();
rollback;
