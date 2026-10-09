-- identity.test.sql
-- Automatic tests for migrations 0001-0005. Everything runs inside one
-- transaction that is rolled back at the end, so no test data is left behind.

begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- ============================================================ test data
-- Three fake users. The signup trigger creates their profiles automatically.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'dev@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'visitor@test.local');

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000a1', id from public.roles where key = 'admin';
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000a2', id from public.roles where key = 'developer';

-- Two updates so we can check the audit trail records changes.
update public.staff_roles set is_active = false
  where user_id = '00000000-0000-0000-0000-0000000000a2';
update public.staff_roles set is_active = true
  where user_id = '00000000-0000-0000-0000-0000000000a2';

-- ===================================================== data and structure
select is(
  (select count(*)::int from public.roles
    where key in ('admin', 'project_manager', 'developer')),
  3, 'the three built-in roles exist');

select is(
  (select count(*)::int from public.permissions p
    where not exists (
      select 1 from public.role_permissions rp
      join public.roles r on r.id = rp.role_id
      where r.key = 'admin' and rp.permission_key = p.key)),
  0, 'admin holds every permission');

select results_eq(
  $$ select rp.permission_key::text from public.role_permissions rp
       join public.roles r on r.id = rp.role_id
      where r.key = 'developer' order by 1 $$,
  $$ values ('projects.update'::text) $$,
  'developer has exactly projects.update');

select is(
  (select count(*)::int from public.role_permissions rp
     join public.roles r on r.id = rp.role_id
    where r.key = 'project_manager'),
  9, 'project_manager has 9 permissions');

select is(
  (select count(*)::int from public.role_permissions rp
     join public.roles r on r.id = rp.role_id
    where r.key = 'project_manager' and rp.permission_key = 'staff.manage'),
  0, 'project_manager cannot manage staff');

select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public' and rowsecurity
      and tablename in ('profiles', 'roles', 'permissions',
                        'role_permissions', 'staff_roles', 'audit_log')),
  6, 'row level security is on for all identity tables');

select is(
  (select count(*)::int from public.profiles
    where id in ('00000000-0000-0000-0000-0000000000a1',
                 '00000000-0000-0000-0000-0000000000a2',
                 '00000000-0000-0000-0000-0000000000a3')),
  3, 'signup trigger created a profile for each new user');

select is(
  (select count(*)::int from public.audit_log
    where entity_type = 'staff_roles' and action = 'insert'
      and entity_id like '00000000-0000-0000-0000-0000000000a1:%'),
  1, 'audit log recorded the admin role assignment');

select is(
  (select count(*)::int from public.audit_log
    where entity_type = 'staff_roles' and action = 'update'
      and entity_id like '00000000-0000-0000-0000-0000000000a2:%'),
  2, 'audit log recorded both updates');

-- ================================================= a visitor (not signed in)
set local role anon;

select is((select count(*)::int from public.profiles), 0,
  'visitor cannot read profiles');
select is((select count(*)::int from public.roles), 0,
  'visitor cannot read roles');
select throws_ok($$ select * from public.audit_log $$, '42501', null,
  'visitor has no access to the audit log');
select throws_ok($$ select app.is_staff() $$, '42501', null,
  'visitor cannot call the helper functions');

-- ============================================================= an admin
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
end $$;

select ok(app.is_staff(), 'admin is staff');
select ok(app.has_permission('staff.manage'), 'admin can manage staff');
select is(app.has_permission('no.such.thing'), false,
  'an unknown permission is never granted');
select cmp_ok((select count(*)::int from public.roles), '>=', 3,
  'admin can read roles');
select is(
  (select count(*)::int from public.profiles
    where id in ('00000000-0000-0000-0000-0000000000a1',
                 '00000000-0000-0000-0000-0000000000a2',
                 '00000000-0000-0000-0000-0000000000a3')),
  3, 'admin can read all profiles');
select is(
  (select count(*)::int from public.audit_log
    where entity_id like '00000000-0000-0000-0000-0000000000a1:%'),
  1, 'admin can read the audit log');
select is_empty(
  $$ delete from public.roles where key = 'admin' returning 1 $$,
  'admin cannot delete a built-in role');
select lives_ok(
  $$ insert into public.roles (key, name) values ('tmp_role', 'Temporary role') $$,
  'admin can create a custom role');
select throws_ok(
  $$ insert into public.audit_log (action, entity_type) values ('insert', 'fake') $$,
  '42501', null, 'admin cannot write to the audit log');

-- ========================================================== a developer
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
end $$;

select ok(app.is_staff(), 'developer is staff');
select is(app.has_permission('staff.manage'), false,
  'developer cannot manage staff');
select is(
  (select count(*)::int from public.staff_roles
    where user_id in ('00000000-0000-0000-0000-0000000000a1',
                      '00000000-0000-0000-0000-0000000000a2')),
  1, 'developer sees only their own staff role');
select is((select count(*)::int from public.audit_log), 0,
  'developer cannot read the audit log');
select throws_ok(
  $$ insert into public.staff_roles (user_id, role_id)
     select '00000000-0000-0000-0000-0000000000a2', id
       from public.roles where key = 'admin' $$,
  '42501', null, 'developer cannot make themselves admin');

-- ==================================== a signed-in person who is not staff
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
end $$;

select is(app.is_staff(), false, 'a normal user is not staff');
select is((select count(*)::int from public.profiles), 1,
  'a normal user sees only their own profile');
select is((select count(*)::int from public.roles), 0,
  'a normal user cannot read roles');
select lives_ok(
  $$ update public.profiles set full_name = 'Visitor'
      where id = '00000000-0000-0000-0000-0000000000a3' $$,
  'a user can edit their own profile');
select is(
  (select full_name from public.profiles
    where id = '00000000-0000-0000-0000-0000000000a3'),
  'Visitor', 'the edit was saved');
select is_empty(
  $$ update public.profiles set full_name = 'Hacked'
      where id = '00000000-0000-0000-0000-0000000000a1' returning 1 $$,
  'a user cannot edit someone else''s profile');

-- ================================================================== done
reset role;
select * from finish();
rollback;