-- invoices_storage.test.sql
-- pgTAP tests for migration 0023_private_invoices_bucket:
--   - 'invoices' bucket exists, is private, has 10MB limit and application/pdf mime type
--   - Staff with payments.manage can upload, read, update, delete
--   - Staff with payments.read can read but not upload
--   - Client A can read own invoices (<client_id>/... and <project_id>/...)
--   - Client A CANNOT read Client B's invoices (cross-client isolation)
--   - Clients cannot upload, update, or delete invoices
--   - Unauthenticated users cannot read any invoices

begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- ============================================================= test data

-- Users
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000002301', 'inv-pm@test.local'),       -- PM (payments.manage)
  ('00000000-0000-0000-0000-000000002302', 'inv-reader@test.local'),   -- Reader (payments.read)
  ('00000000-0000-0000-0000-000000002303', 'inv-clia@test.local'),     -- Client A
  ('00000000-0000-0000-0000-000000002304', 'inv-clib@test.local');     -- Client B

-- Staff roles
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-000000002301', id from public.roles where key = 'project_manager';

-- Read-only role for reader
insert into public.roles (id, key, name, description) values
  ('00000000-0000-0000-0000-000000002399', 'inv_reader_role', 'Invoice Reader', 'Read-only payments');
insert into public.role_permissions (role_id, permission_key) values
  ('00000000-0000-0000-0000-000000002399', 'payments.read');
insert into public.staff_roles (user_id, role_id) values
  ('00000000-0000-0000-0000-000000002302', '00000000-0000-0000-0000-000000002399');

-- Clients
insert into public.clients (id, user_id, full_name, email, stage, source) values
  ('00000000-0000-0000-0000-0000000023c1', '00000000-0000-0000-0000-000000002303', 'Client A', 'inv-clia@test.local', 'active', 'website'),
  ('00000000-0000-0000-0000-0000000023c2', '00000000-0000-0000-0000-000000002304', 'Client B', 'inv-clib@test.local', 'active', 'website');

-- Projects
insert into public.projects (id, client_id, title, created_by, status) values
  ('00000000-0000-0000-0000-000000002311', '00000000-0000-0000-0000-0000000023c1', 'Project A', '00000000-0000-0000-0000-000000002301', 'active'),
  ('00000000-0000-0000-0000-000000002312', '00000000-0000-0000-0000-0000000023c2', 'Project B', '00000000-0000-0000-0000-000000002301', 'active');

-- ============================================================= bucket verification

select isnt_empty(
  $$ select 1 from storage.buckets where id = 'invoices' and public = false $$,
  'invoices bucket exists and is private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'invoices'),
  10485760::bigint,
  'invoices bucket has 10MB limit'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'invoices'),
  array['application/pdf']::text[],
  'invoices bucket accepts application/pdf'
);

-- Seed storage objects directly as admin/service_role
insert into storage.objects (id, bucket_id, name, owner, metadata) values
  ('00000000-0000-0000-0000-0000000023f1', 'invoices', '00000000-0000-0000-0000-0000000023c1/inv-1.pdf', '00000000-0000-0000-0000-000000002301', '{"mimetype": "application/pdf"}'),
  ('00000000-0000-0000-0000-0000000023f2', 'invoices', '00000000-0000-0000-0000-000000002311/inv-proj.pdf', '00000000-0000-0000-0000-000000002301', '{"mimetype": "application/pdf"}'),
  ('00000000-0000-0000-0000-0000000023f3', 'invoices', '00000000-0000-0000-0000-0000000023c2/inv-2.pdf', '00000000-0000-0000-0000-000000002301', '{"mimetype": "application/pdf"}');

-- ============================================================= staff access

-- PM has payments.manage
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000002301","role":"authenticated"}', true); end $$;

select is(
  (select count(*)::int from storage.objects where bucket_id = 'invoices'),
  3,
  'staff with payments.manage can read all invoice objects'
);

select lives_ok(
  $$ insert into storage.objects (id, bucket_id, name, owner)
     values ('00000000-0000-0000-0000-0000000023f4', 'invoices', '00000000-0000-0000-0000-0000000023c1/inv-new.pdf', auth.uid()) $$,
  'staff with payments.manage can upload invoice objects'
);

select lives_ok(
  $$ update storage.objects set metadata = '{"updated": true}'
     where id = '00000000-0000-0000-0000-0000000023f4' $$,
  'staff with payments.manage can update invoice objects'
);

select lives_ok(
  $$ delete from storage.objects where id = '00000000-0000-0000-0000-0000000023f4' $$,
  'staff with payments.manage can delete invoice objects'
);

-- Reader has only payments.read
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000002302","role":"authenticated"}', true); end $$;

select is(
  (select count(*)::int from storage.objects where bucket_id = 'invoices'),
  3,
  'reader with payments.read can read invoice objects'
);

select throws_ok(
  $$ insert into storage.objects (id, bucket_id, name, owner)
     values ('00000000-0000-0000-0000-0000000023f5', 'invoices', 'hack.pdf', auth.uid()) $$,
  '42501',
  null,
  'reader cannot upload invoice objects (missing payments.manage)'
);

-- ============================================================= client access & isolation

-- Client A
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000002303","role":"authenticated"}', true); end $$;

select isnt_empty(
  $$ select 1 from storage.objects
      where bucket_id = 'invoices'
        and name = '00000000-0000-0000-0000-0000000023c1/inv-1.pdf' $$,
  'client A can see own client-prefixed invoice'
);

select isnt_empty(
  $$ select 1 from storage.objects
      where bucket_id = 'invoices'
        and name = '00000000-0000-0000-0000-000000002311/inv-proj.pdf' $$,
  'client A can see own project-prefixed invoice'
);

-- Cross-client isolation: Client A cannot see Client B's invoice
select is_empty(
  $$ select 1 from storage.objects
      where bucket_id = 'invoices'
        and name = '00000000-0000-0000-0000-0000000023c2/inv-2.pdf' $$,
  'client A cannot see client B invoices (cross-client isolation)'
);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'invoices'),
  2,
  'client A only sees their own 2 invoices'
);

-- Client cannot insert/upload
select throws_ok(
  $$ insert into storage.objects (id, bucket_id, name, owner)
     values ('00000000-0000-0000-0000-0000000023f6', 'invoices', '00000000-0000-0000-0000-0000000023c1/hack.pdf', auth.uid()) $$,
  '42501',
  null,
  'client cannot upload invoice objects'
);

-- Client cannot update
select is_empty(
  $$ update storage.objects set metadata = '{"hack": true}'
     where name = '00000000-0000-0000-0000-0000000023c1/inv-1.pdf'
     returning 1 $$,
  'client cannot update invoice objects'
);

-- Client cannot delete
select is_empty(
  $$ delete from storage.objects
     where name = '00000000-0000-0000-0000-0000000023c1/inv-1.pdf'
     returning 1 $$,
  'client cannot delete invoice objects'
);

-- ============================================================= Client B check
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000002304","role":"authenticated"}', true); end $$;

select is(
  (select count(*)::int from storage.objects where bucket_id = 'invoices'),
  1,
  'client B only sees their own 1 invoice'
);

-- ============================================================= anon access
reset role;
set local role anon;

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'invoices' $$,
  'anonymous user cannot see any invoices in private bucket'
);

-- ============================================================= finish
reset role;
select * from finish();
rollback;
