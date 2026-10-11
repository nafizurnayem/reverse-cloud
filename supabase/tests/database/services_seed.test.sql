-- services_seed.test.sql
-- Checks migration 0010: the service list exists and nothing is public yet.

begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select is(
  (select count(*)::int from public.services
    where slug in ('website-development', 'ai-automation', 'ai-chatbots-agents',
                   'ui-ux-design', 'software-development', 'system-management',
                   'system-architecture-design', 'marketing', 'crm-integration',
                   'adsense-services', 'saas-development')),
  11, 'all 11 services are seeded');

select is(
  (select count(*)::int from public.services
    where slug in ('website-development', 'ai-automation', 'ai-chatbots-agents',
                   'ui-ux-design', 'software-development', 'system-management',
                   'system-architecture-design', 'marketing', 'crm-integration',
                   'adsense-services', 'saas-development')
      and is_published),
  0, 'none of them is published until real text is written');

select * from finish();
rollback;