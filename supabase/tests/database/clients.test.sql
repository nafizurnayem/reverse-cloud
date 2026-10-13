-- clients.test.sql
-- Automatic tests for migration 0013_clients.sql (clients table, my_client_id, policies).
-- Everything runs inside one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- ============================================================ test data
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'cl-admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'cl-pm@test.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'cl-dev@test.local'),
  ('00000000-0000-0000-0000-0000000000c4', 'cl-a@test.local'),
  ('00000000-0000-0000-0000-0000000000c5', 'cl-b@test.local'),
  ('00000000-0000-0000-0000-0000000000c6', 'cl-nobody@test.local');

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000c1', id from public.roles where key = 'admin';
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000c2', id from public.roles where key = 'project_manager';
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000c3', id from public.roles where key = 'developer';

insert into public.clients (id, user_id, full_name, email, source) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-0000000000c4',
   'Client A', 'a@example.com', 'website'),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-0000000000c5',
   'Client B', 'b@example.com', 'website');
insert into public.clients (id, full_name, source, source_ref) values
  ('00000000-0000-0000-0000-000000000a03', 'Fiverr buyer', 'fiverr', 'order-1001');

-- ===================================================== structure and rules
select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public' and rowsecurity and tablename = 'clients'),
  1, 'row level security is on for clients');

select throws_ok(
  $$ insert into public.clients (full_name, stage) values ('Odd stage', 'weird') $$,
  '23514', null, 'a client stage must be a known one');

select throws_ok(
  $$ insert into public.clients (full_name, source) values ('Odd source', 'weird') $$,
  '23514', null, 'a client source must be a known one');

select throws_ok(
  $$ insert into public.clients (full_name, email) values ('Bad email', 'not-an-email') $$,
  '23514', null, 'a client email must look like an email');

select throws_ok(
  $$ insert into public.clients (full_name, email) values ('Blank name  ', 'blank@example.com'),
                                                         ('   ', 'blank2@example.com') $$,
  '23514', null, 'a client needs a real name');

select throws_ok(
  $$ insert into public.clients (full_name, email) values ('Same email', 'A@Example.com') $$,
  '23505', null, 'two clients cannot share an email, whatever the letter case');

select throws_ok(
  $$ insert into public.clients (full_name, user_id)
     values ('Same account', '00000000-0000-0000-0000-0000000000c4') $$,
  '23505', null, 'one account can be linked to only one client');

select fk_ok('public', 'leads', 'converted_client_id', 'public', 'clients', 'id',
  'leads point to the client they were converted into');

select is(
  (select count(*)::int from public.audit_log
    where entity_type = 'clients' and action = 'insert'),
  3, 'creating clients is written to the audit log');

-- ============================================== a visitor (not signed in)
set local role anon;

select throws_ok(
  $$ select count(*) from public.clients $$,
  '42501', null, 'visitor cannot read clients');
select throws_ok(
  $$ insert into public.clients (full_name, email) values ('Visitor', 'v@example.com') $$,
  '42501', null, 'visitor cannot add a client');

-- ================================================================= client A
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c4","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.clients), 1,
  'a client sees only their own record');
select is(app.my_client_id(), '00000000-0000-0000-0000-000000000a01'::uuid,
  'my_client_id finds the signed-in client');
select lives_ok(
  $$ update public.clients set full_name = 'Client A Renamed', phone = '+8801700000001'
     where id = '00000000-0000-0000-0000-000000000a01' $$,
  'a client can change their name and phone');
select is(
  (select full_name from public.clients where id = '00000000-0000-0000-0000-000000000a01'),
  'Client A Renamed', 'the client change was saved');
select throws_ok(
  $$ update public.clients set stage = 'active'
     where id = '00000000-0000-0000-0000-000000000a01' $$,
  '42501', null, 'a client cannot change their own stage');
select throws_ok(
  $$ update public.clients set source = 'referral'
     where id = '00000000-0000-0000-0000-000000000a01' $$,
  '42501', null, 'a client cannot change their own source');
select throws_ok(
  $$ update public.clients set email = 'other@example.com'
     where id = '00000000-0000-0000-0000-000000000a01' $$,
  '42501', null, 'a client cannot change their own email');
select throws_ok(
  $$ update public.clients set archived_at = now()
     where id = '00000000-0000-0000-0000-000000000a01' $$,
  '42501', null, 'a client cannot archive themselves');
select throws_ok(
  $$ update public.clients set user_id = '00000000-0000-0000-0000-0000000000c6'
     where id = '00000000-0000-0000-0000-000000000a01' $$,
  '42501', null, 'a client cannot re-link their record to another account');
select is(
  (select count(*)::int from public.clients where id = '00000000-0000-0000-0000-000000000a02'),
  0, 'a client cannot see another client');
select lives_ok(
  $$ update public.clients set full_name = 'Hacked'
     where id = '00000000-0000-0000-0000-000000000a02' $$,
  'changing another client touches nothing');
select throws_ok(
  $$ insert into public.clients (full_name, email) values ('Fake client', 'fake@example.com') $$,
  '42501', null, 'a client cannot add clients');
select throws_ok(
  $$ delete from public.clients where id = '00000000-0000-0000-0000-000000000a01' $$,
  '42501', null, 'nobody can delete a client');

-- ================================================ a user with no client record
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c6","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.clients), 0,
  'someone with no client record sees no clients');
select is(app.my_client_id(), null::uuid,
  'my_client_id is empty for someone with no client record');

-- ================================================================ a developer
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.clients), 0,
  'a developer cannot see clients');
select throws_ok(
  $$ insert into public.clients (full_name, email) values ('Dev client', 'dev@example.com') $$,
  '42501', null, 'a developer cannot add a client');

-- ====================================================== a project manager
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.clients), 3,
  'a project manager sees every client');
select lives_ok(
  $$ insert into public.clients (full_name, email, source)
     values ('Walk-in', 'walkin@example.com', 'walk_in') $$,
  'a project manager can add a client');
select is(
  (select created_by from public.clients where email = 'walkin@example.com'),
  '00000000-0000-0000-0000-0000000000c2'::uuid,
  'the staff member who added a client is recorded automatically');
select lives_ok(
  $$ update public.clients set stage = 'active'
     where id = '00000000-0000-0000-0000-000000000a03' $$,
  'a project manager can change a client stage');
select is(
  (select stage from public.clients where id = '00000000-0000-0000-0000-000000000a03'),
  'active', 'the stage change was saved');
select throws_ok(
  $$ update public.clients set user_id = '00000000-0000-0000-0000-0000000000c6'
     where id = '00000000-0000-0000-0000-000000000a03' $$,
  '42501', null, 'staff cannot link an account directly');
select throws_ok(
  $$ insert into public.clients (full_name, email, user_id)
     values ('Pre-linked', 'pre@example.com', '00000000-0000-0000-0000-0000000000c6') $$,
  '42501', null, 'staff cannot add a client that is already linked');
select throws_ok(
  $$ delete from public.clients where id = '00000000-0000-0000-0000-000000000a03' $$,
  '42501', null, 'staff cannot delete a client');

-- ================================================================== done
reset role;
select is(
  (select full_name from public.clients where id = '00000000-0000-0000-0000-000000000a02'),
  'Client B', 'client B was never changed by client A');

select * from finish();
rollback;
