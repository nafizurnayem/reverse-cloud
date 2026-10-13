-- projects.test.sql
-- pgTAP tests for 0015_projects:
--   projects, project_members, milestones, project_updates
--   progress trigger (staff + client views)
--   milestone weight constraint trigger
--   RLS for staff (projects.create / projects.update) and clients
-- Everything runs inside one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

-- ============================================================= test data

-- Fixed UUIDs: pr- prefix = projects tests
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001501', 'pr-pm@test.local'),   -- project_manager
  ('00000000-0000-0000-0000-000000001502', 'pr-dev@test.local'),  -- developer
  ('00000000-0000-0000-0000-000000001503', 'pr-cli@test.local');  -- client user

insert into public.staff_roles (user_id, role_id)
  select '00000000-0000-0000-0000-000000001501', id from public.roles where key = 'project_manager';
insert into public.staff_roles (user_id, role_id)
  select '00000000-0000-0000-0000-000000001502', id from public.roles where key = 'developer';

insert into public.clients (id, user_id, full_name, email, stage, source) values
  ('00000000-0000-0000-0000-0000000015c1',
   '00000000-0000-0000-0000-000000001503',
   'PR Client', 'pr-cli@test.local', 'active', 'website');

-- A project owned by that client.
insert into public.projects (id, client_id, title, created_by) values
  ('00000000-0000-0000-0000-000000001510',
   '00000000-0000-0000-0000-0000000015c1',
   'PR Test Project',
   '00000000-0000-0000-0000-000000001501');

-- ============================================================= schema checks

select has_column('public', 'projects', 'id',                  'projects.id exists');
select has_column('public', 'projects', 'client_id',           'projects.client_id exists');
select has_column('public', 'projects', 'status',              'projects.status exists');
select has_column('public', 'projects', 'progress_pct',        'projects.progress_pct exists');
select has_column('public', 'projects', 'client_progress_pct', 'projects.client_progress_pct exists');
select has_column('public', 'projects', 'preview_url',         'projects.preview_url exists');

select has_column('public', 'milestones', 'id',                'milestones.id exists');
select has_column('public', 'milestones', 'weight',            'milestones.weight exists');
select has_column('public', 'milestones', 'is_done',           'milestones.is_done exists');
select has_column('public', 'milestones', 'is_client_visible', 'milestones.is_client_visible exists');
select has_column('public', 'milestones', 'preview_url',       'milestones.preview_url exists');

select has_column('public', 'project_updates', 'id',                'project_updates.id exists');
select has_column('public', 'project_updates', 'is_client_visible', 'project_updates.is_client_visible exists');

-- ============================================================= progress trigger

-- No milestones yet: both columns NULL.
select is(
  (select progress_pct from public.projects
    where id = '00000000-0000-0000-0000-000000001510'),
  null::numeric,
  'progress_pct is NULL when no milestones'
);
select is(
  (select client_progress_pct from public.projects
    where id = '00000000-0000-0000-0000-000000001510'),
  null::numeric,
  'client_progress_pct is NULL when no milestones'
);

-- Insert milestones in one deferred transaction (weights: 40 + 35 + 25 = 100).
-- M1: visible, not done | M2: visible, done | M3: hidden, done
set constraints milestones_weights_must_sum_to_100 deferred;
insert into public.milestones
  (id, project_id, title, weight, is_done, is_client_visible, sort_order) values
  ('00000000-0000-0000-0000-000000151001',
   '00000000-0000-0000-0000-000000001510', 'M1 visible not done', 40, false, true,  1),
  ('00000000-0000-0000-0000-000000151002',
   '00000000-0000-0000-0000-000000001510', 'M2 visible done',     35, true,  true,  2),
  ('00000000-0000-0000-0000-000000151003',
   '00000000-0000-0000-0000-000000001510', 'M3 hidden done',      25, true,  false, 3);

-- Staff progress = (35+25)/100 * 100 = 60.00
select is(
  (select progress_pct from public.projects
    where id = '00000000-0000-0000-0000-000000001510'),
  60.00::numeric,
  'staff progress_pct = 60.00'
);

-- Client progress = 35/(40+35) * 100 = 46.67
select is(
  (select client_progress_pct from public.projects
    where id = '00000000-0000-0000-0000-000000001510'),
  46.67::numeric,
  'client_progress_pct = 46.67 (visible milestones only)'
);

-- Mark M1 done: both = 100.00
update public.milestones
   set is_done = true
 where id = '00000000-0000-0000-0000-000000151001';

select is(
  (select progress_pct from public.projects
    where id = '00000000-0000-0000-0000-000000001510'),
  100.00::numeric,
  'staff progress_pct = 100 after all done'
);
select is(
  (select client_progress_pct from public.projects
    where id = '00000000-0000-0000-0000-000000001510'),
  100.00::numeric,
  'client_progress_pct = 100 after all visible done'
);

-- Hide all: client_progress_pct becomes NULL, staff stays 100.
update public.milestones
   set is_client_visible = false
 where project_id = '00000000-0000-0000-0000-000000001510';

select is(
  (select progress_pct from public.projects
    where id = '00000000-0000-0000-0000-000000001510'),
  100.00::numeric,
  'staff progress_pct unchanged when all milestones hidden'
);
select is(
  (select client_progress_pct from public.projects
    where id = '00000000-0000-0000-0000-000000001510'),
  null::numeric,
  'client_progress_pct is NULL when no visible milestones'
);

-- Restore for RLS tests.
update public.milestones
   set is_client_visible = true, is_done = false
 where project_id = '00000000-0000-0000-0000-000000001510';

-- ============================================================= weight constraint

-- Single milestone whose weight != 100 must fail.
set constraints milestones_weights_must_sum_to_100 immediate;
select throws_ok(
  $$
    insert into public.milestones (project_id, title, weight, is_done, is_client_visible)
    values ('00000000-0000-0000-0000-000000001510', 'Bad', 50, false, true)
  $$,
  '23514',
  null,
  'weight not summing to 100 raises 23514'
);
set constraints milestones_weights_must_sum_to_100 deferred;

-- ============================================================= RLS: project manager
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001501","role":"authenticated"}', true); end $$;

select isnt_empty(
  $$ select 1 from public.projects
     where id = '00000000-0000-0000-0000-000000001510' $$,
  'PM can read projects'
);

select lives_ok(
  $$ update public.projects set title = 'Updated'
     where id = '00000000-0000-0000-0000-000000001510' $$,
  'PM can update project title'
);

-- PM cannot set progress_pct directly (column not granted).
select throws_ok(
  $$ update public.projects set progress_pct = 99
     where id = '00000000-0000-0000-0000-000000001510' $$,
  '42501',
  null,
  'PM cannot set progress_pct directly'
);

select isnt_empty(
  $$ select 1 from public.milestones
     where project_id = '00000000-0000-0000-0000-000000001510' $$,
  'PM can read milestones'
);

-- PM can write a project_update.
select lives_ok(
  $$ insert into public.project_updates (project_id, author_id, body, is_client_visible)
     values ('00000000-0000-0000-0000-000000001510',
             '00000000-0000-0000-0000-000000001501',
             'Status post', true) $$,
  'PM can insert project_update'
);

-- ============================================================= RLS: developer
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001502","role":"authenticated"}', true); end $$;

-- Developer has projects.update — can read projects.
select isnt_empty(
  $$ select 1 from public.projects
     where id = '00000000-0000-0000-0000-000000001510' $$,
  'developer can read projects'
);

-- Developer can mark a milestone done.
select lives_ok(
  $$ update public.milestones set is_done = true, done_at = now()
     where id = '00000000-0000-0000-0000-000000151001' $$,
  'developer can mark milestone done'
);

-- Developer CANNOT create a project (no projects.create).
select throws_ok(
  $$ insert into public.projects (client_id, title)
     values ('00000000-0000-0000-0000-0000000015c1', 'Dev project') $$,
  '42501',
  null,
  'developer cannot insert a project'
);

-- Developer CANNOT manage project_members.
select throws_ok(
  $$ insert into public.project_members (project_id, user_id, role)
     values ('00000000-0000-0000-0000-000000001510',
             '00000000-0000-0000-0000-000000001502', 'developer') $$,
  '42501',
  null,
  'developer cannot insert project_members'
);

-- ============================================================= RLS: client
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001503","role":"authenticated"}', true); end $$;

-- Client sees their own project.
select isnt_empty(
  $$ select 1 from public.projects
     where id = '00000000-0000-0000-0000-000000001510' $$,
  'client can read their own project'
);

-- Client cannot insert a project.
select throws_ok(
  $$ insert into public.projects (client_id, title)
     values ('00000000-0000-0000-0000-0000000015c1', 'Client project') $$,
  '42501',
  null,
  'client cannot insert a project'
);

-- Client cannot update a project (update policy excludes them; statement touches 0 rows).
select is_empty(
  $$ update public.projects set title = 'Hacked'
     where id = '00000000-0000-0000-0000-000000001510'
     returning 1 $$,
  'client cannot update a project'
);

-- Client sees client-visible milestones.
select isnt_empty(
  $$ select 1 from public.milestones
     where project_id = '00000000-0000-0000-0000-000000001510'
       and is_client_visible = true $$,
  'client can see client-visible milestones'
);

-- Client cannot write milestones (write policy excludes them; statement touches 0 rows).
select is_empty(
  $$ update public.milestones set is_done = true
     where project_id = '00000000-0000-0000-0000-000000001510'
     returning 1 $$,
  'client cannot update milestones'
);

-- Client sees client-visible updates.
select isnt_empty(
  $$ select 1 from public.project_updates
     where project_id = '00000000-0000-0000-0000-000000001510'
       and is_client_visible = true $$,
  'client sees client-visible project_updates'
);

-- Client cannot write updates.
select throws_ok(
  $$ insert into public.project_updates (project_id, author_id, body, is_client_visible)
     values ('00000000-0000-0000-0000-000000001510',
             '00000000-0000-0000-0000-000000001503', 'Hack', true) $$,
  '42501',
  null,
  'client cannot insert project_updates'
);

-- ============================================================= cancelled project
reset role;
update public.projects
   set status = 'cancelled'
 where id = '00000000-0000-0000-0000-000000001510';

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001503","role":"authenticated"}', true); end $$;

select is_empty(
  $$ select 1 from public.projects
     where id = '00000000-0000-0000-0000-000000001510' $$,
  'client cannot see a cancelled project'
);
select is_empty(
  $$ select 1 from public.milestones
     where project_id = '00000000-0000-0000-0000-000000001510' $$,
  'client cannot see milestones of cancelled project'
);
select is_empty(
  $$ select 1 from public.project_updates
     where project_id = '00000000-0000-0000-0000-000000001510' $$,
  'client cannot see updates of cancelled project'
);

reset role;
select * from finish();
rollback;

