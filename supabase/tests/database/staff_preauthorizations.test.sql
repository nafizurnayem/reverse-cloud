-- staff_preauthorizations.test.sql
-- pgTAP tests for migration 0033: Pre-authorized staff allowlist

begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- 1. Setup Admin user
insert into auth.users (id, email, email_confirmed_at) values
  ('22222222-2222-2222-2222-222222222201', 'admin-invite-tester@test.local', now());

insert into public.profiles (id, full_name) values
  ('22222222-2222-2222-2222-222222222201', 'Admin Invite Tester')
on conflict (id) do nothing;

insert into public.staff_roles (user_id, role_id, is_active)
select '22222222-2222-2222-2222-222222222201', r.id, true
  from public.roles r where r.key = 'admin';

-- 2. Act as Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222201","role":"authenticated"}', true);

-- Test A: Admin preauthorizes a brand new email for Developer role
select is(
  (select (public.preauthorize_staff_member('future-dev@test.local', r.id))->>'status'
     from public.roles r where r.key = 'developer'),
  'preauthorized',
  'Admin successfully preauthorizes a new email'
);

-- Test B: Preauthorization appears in list_pending_staff_invites
select is(
  (select count(*)::int from public.list_pending_staff_invites() where email = 'future-dev@test.local'),
  1,
  'Pending staff invite is listed'
);

-- Test C: Non-staff cannot preauthorize or list pending invites
set local role anon;
select throws_ok(
  $$select public.list_pending_staff_invites()$$,
  '42501',
  null,
  'Anon cannot list pending staff invites'
);

-- Test D: New user signs up with that email -> auto-activation
reset role;
insert into auth.users (id, email, email_confirmed_at) values
  ('22222222-2222-2222-2222-222222222202', 'future-dev@test.local', now());

-- Verify staff role was automatically activated by handle_new_user trigger
select is(
  (select count(*)::int
     from public.staff_roles sr
     join public.roles r on r.id = sr.role_id
    where sr.user_id = '22222222-2222-2222-2222-222222222202'
      and r.key = 'developer'
      and sr.is_active = true),
  1,
  'Developer role automatically assigned to user upon signup'
);

-- Verify invite is marked as accepted
select is(
  (select count(*)::int from public.staff_invites where email = 'future-dev@test.local' and accepted_at is not null),
  1,
  'Invite record marked accepted with timestamp'
);

-- Test E: Revoke invite
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222201","role":"authenticated"}', true);

-- Create another invite to revoke
select public.preauthorize_staff_member('will-be-revoked@test.local', r.id)
  from public.roles r where r.key = 'project_manager';

select is(
  (select public.revoke_staff_invite(si.id)
     from public.staff_invites si
    where si.email = 'will-be-revoked@test.local'),
  true,
  'Admin can revoke a pending staff invite'
);

select is(
  (select count(*)::int from public.list_pending_staff_invites() where email = 'will-be-revoked@test.local'),
  0,
  'Revoked invite is no longer in pending list'
);

select * from finish();
rollback;
