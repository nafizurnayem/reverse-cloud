begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000002701', 'first-admin@test.local'),
  ('00000000-0000-4000-8000-000000002702', 'second-admin@test.local'),
  ('00000000-0000-4000-8000-000000002703', 'staff-target@test.local'),
  ('00000000-0000-4000-8000-000000002704', 'ordinary-user@test.local');

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-4000-8000-000000002701', id
  from public.roles where key = 'admin';

select has_function(
  'public', 'set_staff_role_status', array['uuid', 'uuid', 'boolean'],
  'staff-role status function exists'
);
select function_returns(
  'public', 'set_staff_role_status', array['uuid', 'uuid', 'boolean'], 'boolean',
  'staff-role status function returns boolean'
);
select has_function(
  'public', 'list_staff_directory', array[]::text[],
  'staff directory function exists'
);

set local role anon;
select throws_ok(
  $$ select public.set_staff_role_status(
       '00000000-0000-4000-8000-000000002703',
       (select id from public.roles where key = 'developer'), true) $$,
  '42501', null, 'anonymous users cannot assign staff roles'
);

reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000002704","role":"authenticated"}', true);
end $$;
select throws_ok(
  $$ select public.set_staff_role_status(
       '00000000-0000-4000-8000-000000002703',
       (select id from public.roles where key = 'developer'), true) $$,
  '42501', 'permission_denied', 'ordinary users cannot assign staff roles'
);
select throws_ok(
  $$ select * from public.list_staff_directory() $$,
  '42501', 'permission_denied', 'ordinary users cannot list the staff directory'
);

reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000002701","role":"authenticated"}', true);
end $$;

select is(
  (select count(*)::integer from public.list_staff_directory()
    where user_id in (
      '00000000-0000-4000-8000-000000002701',
      '00000000-0000-4000-8000-000000002702',
      '00000000-0000-4000-8000-000000002703',
      '00000000-0000-4000-8000-000000002704'
    )),
  4, 'an administrator can list authenticated users'
);

select throws_ok(
  $$ insert into public.staff_roles (user_id, role_id)
     select '00000000-0000-4000-8000-000000002703', id
       from public.roles where key = 'developer' $$,
  '42501', null, 'authenticated clients cannot bypass the RPC with direct inserts'
);

select ok(
  public.set_staff_role_status(
    '00000000-0000-4000-8000-000000002703',
    (select id from public.roles where key = 'developer'), true),
  'an admin can assign a role'
);
select is(
  (select is_active from public.staff_roles
    where user_id = '00000000-0000-4000-8000-000000002703'
      and role_id = (select id from public.roles where key = 'developer')),
  true, 'the new assignment is active'
);
select ok(
  public.set_staff_role_status(
    '00000000-0000-4000-8000-000000002703',
    (select id from public.roles where key = 'developer'), false),
  'an admin can deactivate an assignment'
);
select is(
  (select is_active from public.staff_roles
    where user_id = '00000000-0000-4000-8000-000000002703'
      and role_id = (select id from public.roles where key = 'developer')),
  false, 'deactivation preserves the assignment row'
);
select throws_ok(
  $$ select public.set_staff_role_status(
       '00000000-0000-4000-8000-000000002701',
       (select id from public.roles where key = 'admin'), false) $$,
  'P0001', 'last_active_admin', 'the final active admin cannot be deactivated'
);

select ok(
  public.set_staff_role_status(
    '00000000-0000-4000-8000-000000002702',
    (select id from public.roles where key = 'admin'), true),
  'an admin can assign a second administrator'
);
select ok(
  public.set_staff_role_status(
    '00000000-0000-4000-8000-000000002701',
    (select id from public.roles where key = 'admin'), false),
  'an administrator can be deactivated when another active admin remains'
);
select is(
  (select count(*)::integer
     from public.staff_roles sr
     join public.roles r on r.id = sr.role_id
    where r.key = 'admin' and sr.is_active),
  1, 'one active administrator remains'
);

reset role;
select * from finish();
rollback;
