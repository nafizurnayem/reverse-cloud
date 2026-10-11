-- estimator.test.sql
-- Automatic tests for migration 0008 (estimator and wizard tables).
-- These check the rules built into the tables. Who may read and write them
-- is tested after migration 0009.
-- Everything runs inside one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- ============================================================ test data
insert into public.services (slug, name_en) values ('est-svc', 'Estimator test service');

insert into public.estimator_versions (version, status, usd_to_bdt, activated_at) values
  (1, 'active', 120, now());
insert into public.estimator_versions (version, status, usd_to_bdt) values
  (2, 'draft', 121);

insert into public.estimator_service_rates (version_id, service_id, base_min, base_max, weeks_min, weeks_max)
select v.id, s.id, 500, 1500, 2, 4
from public.estimator_versions v, public.services s
where v.version = 1 and s.slug = 'est-svc';

insert into public.estimator_factors (version_id, kind, key, label_en, multiplier)
select id, 'complexity', 'simple', 'Simple', 1 from public.estimator_versions where version = 1;

insert into public.estimator_factors (version_id, kind, key, label_en, monthly_min, monthly_max)
select id, 'support', 'basic', 'Basic support', 50, 100
from public.estimator_versions where version = 1;

insert into public.estimates (version_id, service_id, inputs, min_usd, max_usd, min_bdt, max_bdt, weeks_min, weeks_max)
select v.id, s.id, '{"complexity":"simple"}'::jsonb, 500, 1500, 60000, 180000, 2, 4
from public.estimator_versions v, public.services s
where v.version = 1 and s.slug = 'est-svc';

insert into public.wizard_questions (key, text_en) values ('goal', 'What do you need?');
insert into public.wizard_options (question_id, label_en)
select id, 'A new website' from public.wizard_questions where key = 'goal';
insert into public.wizard_option_scores (option_id, service_id, weight)
select o.id, s.id, 3 from public.wizard_options o, public.services s
where o.label_en = 'A new website' and s.slug = 'est-svc';

-- ===================================================== structure and rules
select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public' and rowsecurity
      and tablename in ('estimator_versions', 'estimator_service_rates', 'estimator_factors',
                        'estimates', 'wizard_questions', 'wizard_options', 'wizard_option_scores')),
  7, 'row level security is on for all estimator and wizard tables');

select throws_ok(
  $$ update public.estimator_versions
        set status = 'active', activated_at = now() where version = 2 $$,
  '23505', null, 'only one estimator version can be active');

select throws_ok(
  $$ insert into public.estimator_service_rates
       (version_id, service_id, base_min, base_max, weeks_min, weeks_max)
     select v.id, s.id, 1000, 500, 1, 2
       from public.estimator_versions v, public.services s
      where v.version = 2 and s.slug = 'est-svc' $$,
  '23514', null, 'a rate cannot have a maximum below its minimum');

select throws_ok(
  $$ insert into public.estimator_service_rates
       (version_id, service_id, base_min, base_max, weeks_min, weeks_max)
     select v.id, s.id, 100, 200, 1, 2
       from public.estimator_versions v, public.services s
      where v.version = 1 and s.slug = 'est-svc' $$,
  '23505', null, 'a service has only one rate per version');

select throws_ok(
  $$ insert into public.estimator_factors (version_id, kind, key, label_en, add_min, add_max)
     select id, 'support', 'bad-support', 'Bad support', 10, 20
       from public.estimator_versions where version = 2 $$,
  '23514', null, 'a support factor cannot add to the project price');

select throws_ok(
  $$ insert into public.estimator_factors (version_id, kind, key, label_en, monthly_min, monthly_max)
     select id, 'addon', 'bad-addon', 'Bad add-on', 10, 20
       from public.estimator_versions where version = 2 $$,
  '23514', null, 'only support factors can have monthly amounts');

select throws_ok(
  $$ insert into public.estimator_factors (version_id, kind, key, label_en)
     select id, 'complexity', 'simple', 'Simple again'
       from public.estimator_versions where version = 1 $$,
  '23505', null, 'a factor key is unique within its version');

select throws_ok(
  $$ insert into public.estimates (version_id, service_id, min_usd, max_usd, min_bdt, max_bdt, weeks_min, weeks_max)
     select v.id, s.id, 100, 50, 12000, 6000, 1, 2
       from public.estimator_versions v, public.services s
      where v.version = 1 and s.slug = 'est-svc' $$,
  '23514', null, 'an estimate cannot have a maximum below its minimum');

select throws_ok(
  $$ delete from public.estimator_versions where version = 1 $$,
  '23503', null, 'a version with saved estimates cannot be deleted');

select throws_ok(
  $$ insert into public.wizard_option_scores (option_id, service_id, weight)
     select o.id, s.id, 5 from public.wizard_options o, public.services s
      where o.label_en = 'A new website' and s.slug = 'est-svc' $$,
  '23505', null, 'an option scores a service only once');

-- ================================================================== done
select * from finish();
rollback;