-- estimator_policies.test.sql
-- Automatic tests for migration 0009: who can see and change the estimator
-- and wizard, the "no edits to a used version" rule, and clone/activate.
-- Everything runs inside one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- ============================================================ test data
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'est-admin@test.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'est-pm@test.local'),
  ('00000000-0000-0000-0000-0000000000e3', 'est-user@test.local');

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000e1', id from public.roles where key = 'admin';
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000e2', id from public.roles where key = 'project_manager';

insert into public.services (slug, name_en) values ('pol-svc', 'Policy test service');

-- Version 1 (will be active) and version 2 (draft) each have a rate.
-- Version 3 is a draft with no rates.
insert into public.estimator_versions (version, status, usd_to_bdt) values
  (1, 'draft', 120), (2, 'draft', 121), (3, 'draft', 122);

insert into public.estimator_service_rates (version_id, service_id, base_min, base_max, weeks_min, weeks_max)
select v.id, s.id, 500, 1500, 2, 4
from public.estimator_versions v, public.services s
where s.slug = 'pol-svc' and v.version in (1, 2);

insert into public.estimator_factors (version_id, kind, key, label_en, multiplier)
select id, 'complexity', 'simple', 'Simple', 1
from public.estimator_versions where version = 1;
insert into public.estimator_factors (version_id, kind, key, label_en, monthly_min, monthly_max)
select id, 'support', 'basic', 'Basic support', 50, 100
from public.estimator_versions where version = 1;

update public.estimator_versions
   set status = 'active', activated_at = now() where version = 1;

insert into public.estimates (version_id, service_id, min_usd, max_usd, min_bdt, max_bdt, weeks_min, weeks_max)
select v.id, s.id, 500, 1500, 60000, 180000, 2, 4
from public.estimator_versions v, public.services s
where v.version = 1 and s.slug = 'pol-svc';

-- Wizard: one active question and one inactive question, each with an option and a score.
insert into public.wizard_questions (key, text_en, is_active) values
  ('q-active', 'Active question', true),
  ('q-inactive', 'Inactive question', false);
insert into public.wizard_options (question_id, label_en)
select id, 'Option for ' || key from public.wizard_questions;
insert into public.wizard_option_scores (option_id, service_id, weight)
select o.id, s.id, 2 from public.wizard_options o, public.services s
where s.slug = 'pol-svc';

-- ================================================ a used version is locked
select throws_ok(
  $$ update public.estimator_service_rates set base_max = 2000
      where version_id = (select id from public.estimator_versions where version = 1) $$,
  '55000', null, 'a rate of an active version cannot be edited');

select throws_ok(
  $$ insert into public.estimator_factors (version_id, kind, key, label_en)
     select id, 'addon', 'late-addon', 'Late add-on'
       from public.estimator_versions where version = 1 $$,
  '55000', null, 'a factor cannot be added to an active version');

select throws_ok(
  $$ update public.estimator_versions set usd_to_bdt = 130 where version = 1 $$,
  '55000', null, 'the exchange rate of an active version cannot change');

select lives_ok(
  $$ update public.estimator_service_rates set base_max = 2000
      where version_id = (select id from public.estimator_versions where version = 2) $$,
  'a draft version can still be edited');

-- ================================================= a visitor (not signed in)
set local role anon;

select is((select count(*)::int from public.wizard_questions), 1,
  'visitor sees only active wizard questions');
select is((select count(*)::int from public.wizard_options), 1,
  'visitor sees options only of active questions');
select is((select count(*)::int from public.wizard_option_scores), 1,
  'visitor sees scores only of active questions');
select is((select count(*)::int from public.estimator_versions), 0,
  'visitor cannot see estimator versions');
select is((select count(*)::int from public.estimates), 0,
  'visitor cannot see estimates');
select throws_ok(
  $$ select public.clone_estimator_version('00000000-0000-0000-0000-000000000000'::uuid) $$,
  '42501', null, 'visitor cannot call the clone function');

-- ==================================== a signed-in person who is not staff
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.estimator_service_rates), 0,
  'a normal user cannot see estimator rates');
select throws_ok(
  $$ select public.clone_estimator_version('00000000-0000-0000-0000-000000000000'::uuid) $$,
  '42501', null, 'a normal user cannot clone a version');
select is((select count(*)::int from public.wizard_questions), 1,
  'a normal user sees only active wizard questions');

-- ====================================================== a project manager
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.estimator_versions), 0,
  'a project manager cannot see estimator versions');
select is((select count(*)::int from public.estimates), 1,
  'a project manager can read estimates');
select throws_ok(
  $$ select public.clone_estimator_version('00000000-0000-0000-0000-000000000000'::uuid) $$,
  '42501', null, 'a project manager cannot clone a version');
select throws_ok(
  $$ insert into public.wizard_questions (key, text_en) values ('pm-q', 'PM question') $$,
  '42501', null, 'a project manager cannot edit the wizard');

-- ================================================================ an admin
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.wizard_questions), 2,
  'admin sees inactive wizard questions too');
select lives_ok(
  $$ insert into public.wizard_questions (key, text_en) values ('admin-q', 'Admin question') $$,
  'admin can create a wizard question');
select is((select count(*)::int from public.estimator_versions), 3,
  'admin sees all estimator versions');

select lives_ok(
  $$ select public.clone_estimator_version(
       (select id from public.estimator_versions where version = 1)) $$,
  'admin can clone a version');
select is(
  (select count(*)::int from public.estimator_service_rates
    where version_id = (select id from public.estimator_versions where version = 4)),
  1, 'the clone copied the service rates');
select is(
  (select count(*)::int from public.estimator_factors
    where version_id = (select id from public.estimator_versions where version = 4)),
  2, 'the clone copied the factors');

select throws_ok(
  $$ select public.activate_estimator_version(
       (select id from public.estimator_versions where version = 3)) $$,
  '55000', null, 'a version with no service rates cannot be activated');
select lives_ok(
  $$ select public.activate_estimator_version(
       (select id from public.estimator_versions where version = 4)) $$,
  'admin can activate the cloned version');
select is(
  (select status from public.estimator_versions where version = 1),
  'archived', 'the previously active version was archived');
select is(
  (select status from public.estimator_versions where version = 4),
  'active', 'the cloned version is now active');
select is(
  (select count(*)::int from public.estimator_versions where status = 'active'),
  1, 'exactly one version is active');

-- ================================================================== done
reset role;
select * from finish();
rollback;