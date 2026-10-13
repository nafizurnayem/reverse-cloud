-- payments.test.sql
-- pgTAP tests for 0016_payments:
--   payment_items and payments tables
--   currency-safe composite FK
--   auto-paid trigger (mark paid / revert to pending)
--   RLS for staff (payments.manage / payments.read) and clients

begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- ============================================================= test data

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001601', 'pay-pm@test.local'),
  ('00000000-0000-0000-0000-000000001602', 'pay-reader@test.local'),
  ('00000000-0000-0000-0000-000000001603', 'pay-cli@test.local');

-- Dedicated read-only payments role
insert into public.roles (id, key, name, description) values
  ('00000000-0000-0000-0000-000000001699', 'pay_reader_role', 'Payment Reader', 'Read-only payments');

insert into public.role_permissions (role_id, permission_key) values
  ('00000000-0000-0000-0000-000000001699', 'payments.read');

-- PM has project_manager role (has payments.manage + read)
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-000000001601', id from public.roles where key = 'project_manager';

-- Reader has only pay_reader_role
insert into public.staff_roles (user_id, role_id) values
  ('00000000-0000-0000-0000-000000001602', '00000000-0000-0000-0000-000000001699');

-- Client record
insert into public.clients (id, user_id, full_name, email, stage, source) values
  ('00000000-0000-0000-0000-0000000016c1',
   '00000000-0000-0000-0000-000000001603',
   'Pay Client', 'pay-cli@test.local', 'active', 'website');

-- Project for client
insert into public.projects (id, client_id, title, created_by) values
  ('00000000-0000-0000-0000-000000001610',
   '00000000-0000-0000-0000-0000000016c1',
   'Payment Test Project',
   '00000000-0000-0000-0000-000000001601');

-- Seed milestone (sum = 100)
set constraints milestones_weights_must_sum_to_100 deferred;
insert into public.milestones (id, project_id, title, weight, is_done, is_client_visible) values
  ('00000000-0000-0000-0000-000000161001',
   '00000000-0000-0000-0000-000000001610',
   'M1', 100, false, true);

-- Seed payment_item
insert into public.payment_items (id, project_id, title, amount_due, currency, sort_order) values
  ('00000000-0000-0000-0000-000000162001',
   '00000000-0000-0000-0000-000000001610',
   'Deposit', 1000.00, 'USD', 1);

-- ============================================================= schema checks

select has_column('public', 'payment_items', 'id',          'payment_items.id exists');
select has_column('public', 'payment_items', 'project_id',  'payment_items.project_id exists');
select has_column('public', 'payment_items', 'amount_due',  'payment_items.amount_due exists');
select has_column('public', 'payment_items', 'currency',    'payment_items.currency exists');
select has_column('public', 'payment_items', 'status',      'payment_items.status exists');
select has_column('public', 'payment_items', 'paid_at',     'payment_items.paid_at exists');

select has_column('public', 'payments', 'id',              'payments.id exists');
select has_column('public', 'payments', 'payment_item_id', 'payments.payment_item_id exists');
select has_column('public', 'payments', 'currency',        'payments.currency exists');
select has_column('public', 'payments', 'amount_paid',     'payments.amount_paid exists');
select has_column('public', 'payments', 'method',          'payments.method exists');

-- ============================================================= auto-paid trigger

-- Status starts as 'pending'
select is(
  (select status from public.payment_items where id = '00000000-0000-0000-0000-000000162001'),
  'pending',
  'payment_item status starts as pending'
);
select is(
  (select paid_at from public.payment_items where id = '00000000-0000-0000-0000-000000162001'),
  null::timestamptz,
  'paid_at is null before any payment'
);

-- Record partial payment (500 of 1000)
insert into public.payments (id, payment_item_id, currency, amount_paid, method) values
  ('00000000-0000-0000-0000-000000163001',
   '00000000-0000-0000-0000-000000162001', 'USD', 500.00, 'bank_transfer');

select is(
  (select status from public.payment_items where id = '00000000-0000-0000-0000-000000162001'),
  'pending',
  'status still pending after partial payment'
);

-- Record remaining 500 -> status flips to paid
insert into public.payments (id, payment_item_id, currency, amount_paid, method) values
  ('00000000-0000-0000-0000-000000163002',
   '00000000-0000-0000-0000-000000162001', 'USD', 500.00, 'bank_transfer');

select is(
  (select status from public.payment_items where id = '00000000-0000-0000-0000-000000162001'),
  'paid',
  'status flips to paid when total >= amount_due'
);
select isnt(
  (select paid_at from public.payment_items where id = '00000000-0000-0000-0000-000000162001'),
  null::timestamptz,
  'paid_at is stamped when item is paid'
);

-- Delete the second payment -> status reverts to pending
delete from public.payments where id = '00000000-0000-0000-0000-000000163002';

select is(
  (select status from public.payment_items where id = '00000000-0000-0000-0000-000000162001'),
  'pending',
  'status reverts to pending when total drops below amount_due'
);

-- ============================================================= currency-safe composite FK

-- Currency mismatch (USD item, GBP payment)
select throws_ok(
  $$ insert into public.payments (payment_item_id, currency, amount_paid)
     values ('00000000-0000-0000-0000-000000162001', 'GBP', 1000.00) $$,
  '23503',
  null,
  'currency mismatch rejected by composite FK (23503 foreign key violation)'
);

-- ============================================================= check constraints

-- amount_due must be > 0
select throws_ok(
  $$ insert into public.payment_items (project_id, title, amount_due, currency)
     values ('00000000-0000-0000-0000-000000001610', 'Bad', 0, 'USD') $$,
  '23514',
  null,
  'amount_due = 0 rejected by check constraint'
);

-- Invalid method enum
select throws_ok(
  $$ insert into public.payments (payment_item_id, currency, amount_paid, method)
     values ('00000000-0000-0000-0000-000000162001', 'USD', 100, 'cheque') $$,
  '23514',
  null,
  'invalid payment method rejected'
);

-- Currency code must be exactly 3 chars
select throws_ok(
  $$ insert into public.payment_items (project_id, title, amount_due, currency)
     values ('00000000-0000-0000-0000-000000001610', 'Bad', 500, 'US') $$,
  '23514',
  null,
  '2-char currency code rejected'
);

-- ============================================================= RLS: payments.manage (PM)

reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001601","role":"authenticated"}', true); end $$;

select isnt_empty(
  $$ select 1 from public.payment_items
     where project_id = '00000000-0000-0000-0000-000000001610' $$,
  'PM can read payment_items'
);

select lives_ok(
  $$ insert into public.payments (payment_item_id, currency, amount_paid, recorded_by)
     values ('00000000-0000-0000-0000-000000162001', 'USD', 250.00, auth.uid()) $$,
  'PM can insert a payment'
);

select lives_ok(
  $$ update public.payments set notes = 'Confirmed'
     where payment_item_id = '00000000-0000-0000-0000-000000162001' $$,
  'PM can update a payment'
);

select lives_ok(
  $$ delete from public.payments
     where payment_item_id = '00000000-0000-0000-0000-000000162001'
       and amount_paid = 250.00 $$,
  'PM can delete a payment'
);

-- ============================================================= RLS: payments.read only

reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001602","role":"authenticated"}', true); end $$;

select isnt_empty(
  $$ select 1 from public.payment_items
     where project_id = '00000000-0000-0000-0000-000000001610' $$,
  'reader can read payment_items'
);

select throws_ok(
  $$ insert into public.payment_items (project_id, title, amount_due, currency)
     values ('00000000-0000-0000-0000-000000001610', 'New', 500, 'USD') $$,
  '42501',
  null,
  'reader cannot insert payment_items (no payments.manage)'
);

-- ============================================================= RLS: client

reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001603","role":"authenticated"}', true); end $$;

select isnt_empty(
  $$ select 1 from public.payment_items
     where project_id = '00000000-0000-0000-0000-000000001610' $$,
  'client can read their own payment_items'
);

select throws_ok(
  $$ insert into public.payment_items (project_id, title, amount_due, currency)
     values ('00000000-0000-0000-0000-000000001610', 'Hack', 1, 'USD') $$,
  '42501',
  null,
  'client cannot insert payment_items'
);

select isnt_empty(
  $$ select 1 from public.payments
     where payment_item_id = '00000000-0000-0000-0000-000000162001' $$,
  'client can read payment records for their items'
);

select throws_ok(
  $$ insert into public.payments (payment_item_id, currency, amount_paid)
     values ('00000000-0000-0000-0000-000000162001', 'USD', 1.00) $$,
  '42501',
  null,
  'client cannot insert payments'
);

-- ============================================================= cancelled project hides items

reset role;
update public.projects
   set status = 'cancelled'
 where id = '00000000-0000-0000-0000-000000001610';

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001603","role":"authenticated"}', true); end $$;

select is_empty(
  $$ select 1 from public.payment_items
     where project_id = '00000000-0000-0000-0000-000000001610' $$,
  'client cannot see payment_items of a cancelled project'
);

select is_empty(
  $$ select 1 from public.payments
     where payment_item_id = '00000000-0000-0000-0000-000000162001' $$,
  'client cannot see payments of a cancelled project'
);

reset role;
select * from finish();
rollback;
