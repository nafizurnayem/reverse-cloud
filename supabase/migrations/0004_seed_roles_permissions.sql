-- 0004_seed_roles_permissions
-- Reference data the app depends on (plan section 3).
-- Safe to re-run: every insert skips rows that already exist.
-- "portal.view_own_project" is deliberately not here: clients are not staff
-- and do not use the role system. Their access comes from RLS policies.

insert into public.permissions (key, description) values
  ('content.manage',   'Edit services, portfolio, blog, FAQs, wizard and site settings'),
  ('reviews.moderate', 'Approve or reject client reviews and add reviews manually'),
  ('estimator.manage', 'Edit estimator rates, factors and versions'),
  ('leads.read',       'View leads and chat conversations'),
  ('leads.manage',     'Update lead status and assignment'),
  ('clients.manage',   'Create and edit clients, send invites'),
  ('projects.create',  'Create projects'),
  ('projects.update',  'Update milestones, progress, updates and preview link'),
  ('payments.manage',  'Create payment schedules and record payments'),
  ('payments.read',    'View payment schedules and recorded payments'),
  ('meetings.read',    'View meetings'),
  ('staff.manage',     'Manage staff, roles and role permissions'),
  ('audit.read',       'View the audit log')
on conflict (key) do nothing;

insert into public.roles (key, name, description, is_system) values
  ('admin',           'Admin',           'Full access to everything',                      true),
  ('project_manager', 'Project manager', 'Runs clients, projects, payments and reviews',   true),
  ('developer',       'Developer',       'Updates progress on projects they are assigned', true)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
join public.permissions p on
     r.key = 'admin'
  or (r.key = 'project_manager' and p.key in (
        'reviews.moderate', 'leads.read', 'leads.manage', 'clients.manage',
        'projects.create', 'projects.update', 'payments.manage',
        'payments.read', 'meetings.read'))
  or (r.key = 'developer' and p.key = 'projects.update')
on conflict do nothing;