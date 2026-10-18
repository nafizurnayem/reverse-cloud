begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Test Fixtures
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000002801', 'client1@test.local'),
  ('00000000-0000-4000-8000-000000002802', 'client2@test.local');

insert into public.clients (id, user_id, full_name, email) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000002801', 'Client One', 'client1@test.local'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000002802', 'Client Two', 'client2@test.local');

insert into public.projects (id, client_id, title, status) values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Client 1 E-commerce', 'active'),
  ('b0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Client 2 Secret FinTech', 'active');

insert into public.milestones (project_id, title, weight, is_done, is_client_visible, sort_order) values
  ('a0000000-0000-4000-8000-000000000001', 'UI Design', 40.00, true, true, 1),
  ('a0000000-0000-4000-8000-000000000001', 'Backend API', 40.00, false, true, 2),
  ('a0000000-0000-4000-8000-000000000001', 'Internal Security Audit', 20.00, false, false, 3),
  ('b0000000-0000-4000-8000-000000000002', 'Initial Delivery', 100.00, true, true, 1);

insert into public.project_updates (project_id, body, is_client_visible) values
  ('a0000000-0000-4000-8000-000000000001', 'Phase 1 deployed to staging', true),
  ('a0000000-0000-4000-8000-000000000001', 'Internal note: awaiting client feedback', false);

-- 1. Direct Table Access Blocks for ai_service role
set local role ai_service;

select throws_ok(
  $$ select * from public.projects $$,
  '42501', null, 'ai_service cannot select directly from public.projects'
);

select throws_ok(
  $$ select * from public.milestones $$,
  '42501', null, 'ai_service cannot select directly from public.milestones'
);

select throws_ok(
  $$ select * from public.project_updates $$,
  '42501', null, 'ai_service cannot select directly from public.project_updates'
);

select throws_ok(
  $$ select * from public.internal_notes $$,
  '42501', null, 'ai_service cannot select directly from public.internal_notes'
);

-- 2. Anonymous Access Block
reset role;
set local role anon;

select throws_ok(
  $$ select * from public.get_client_project_status('10000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'anonymous callers cannot invoke get_client_project_status'
);

-- 3. Authorized ai_service Project Queries
reset role;
set local role ai_service;

select is(
  (select title from public.get_client_project_status(
    '10000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001'
  )),
  'Client 1 E-commerce',
  'ai_service retrieves project title for authorized client'
);

select is(
  (select jsonb_array_length(milestones) from public.get_client_project_status(
    '10000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001'
  )),
  2,
  'ai_service sees only the 2 client-visible milestones (internal milestone hidden)'
);

select is(
  (select milestones::text like '%Internal Security Audit%' from public.get_client_project_status(
    '10000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001'
  )),
  false,
  'internal milestone title does not appear in JSON payload'
);

select is(
  (select recent_updates::text like '%Internal note: awaiting client feedback%' from public.get_client_project_status(
    '10000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001'
  )),
  false,
  'internal project update does not appear in JSON payload'
);

-- 4. Cross-Client Isolation
-- Client 1 trying to query Client 2's project ID
select is(
  (select count(*)::integer from public.get_client_project_status(
    '10000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000002'
  )),
  0,
  'cross-client query (Client 1 probing Client 2 project) returns 0 rows'
);

-- Client 2 querying their own project ID succeeds
select is(
  (select title from public.get_client_project_status(
    '20000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000002'
  )),
  'Client 2 Secret FinTech',
  'client 2 project is returned when queried with client 2 ID'
);

-- 5. Authenticated Client Self-Access vs Impersonation
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000002801","role":"authenticated"}', true);
end $$;

select is(
  (select count(*)::integer from public.get_client_project_status('10000000-0000-4000-8000-000000000001')),
  1,
  'authenticated client 1 can query their own project status'
);

select throws_ok(
  $$ select * from public.get_client_project_status('20000000-0000-4000-8000-000000000002') $$,
  '42501', 'permission_denied', 'authenticated client 1 cannot query client 2 project status'
);

reset role;
select * from finish();
rollback;
