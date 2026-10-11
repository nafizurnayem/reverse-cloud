-- 0010_seed_services
-- The company's service list, as unpublished drafts.
-- A service cannot be published until it has an English summary and body
-- (rule in 0006), so nothing goes live by accident. Staff edit these in the
-- admin screens. Adding a new service later needs no migration.
-- Safe to re-run: existing slugs are skipped.

insert into public.services (slug, name_en, pricing_model, sort_order, is_published) values
  ('website-development',        'Website development',        'fixed',     10, false),
  ('ai-automation',              'AI automation',              'fixed',     20, false),
  ('ai-chatbots-agents',         'AI chatbots and agents',     'fixed',     30, false),
  ('ui-ux-design',               'UI/UX design',               'fixed',     40, false),
  ('software-development',       'Software development',       'fixed',     50, false),
  ('system-management',          'System management',          'retainer',  60, false),
  ('system-architecture-design', 'System architecture design', 'custom',    70, false),
  ('marketing',                  'Marketing',                  'retainer',  80, false),
  ('crm-integration',            'CRM integration',            'fixed',     90, false),
  ('adsense-services',           'AdSense services',           'retainer', 100, false),
  ('saas-development',           'SaaS development',           'custom',   110, false)
on conflict (slug) do nothing;