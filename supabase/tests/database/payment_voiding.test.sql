-- pgTAP coverage for the auditable payment void workflow.

begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000002401', 'void-manager@test.local'),
  ('00000000-0000-0000-0000-000000002402', 'void-client@test.local');

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-000000002401', id
from public.roles where key = 'project_manager';

insert into public.clients (
  id, user_id, full_name, email, preferred_locale, stage, source
) values (
  '00000000-0000-0000-0000-0000000024c1',
  '00000000-0000-0000-0000-000000002402',
  'Void Client', 'void-client@test.local', 'en', 'active', 'website'
);

insert into public.projects (id, client_id, title, status, created_by) values (
  '00000000-0000-0000-0000-000000002410',
  '00000000-0000-0000-0000-0000000024c1',
  'Void Project', 'active',
  '00000000-0000-0000-0000-000000002401'
);

insert into public.payment_items (
  id, project_id, title, amount_due, currency, created_by
) values (
  '00000000-0000-0000-0000-000000242001',
  '00000000-0000-0000-0000-000000002410',
  'Final payment', 500, 'USD',
  '00000000-0000-0000-0000-000000002401'
);

-- Fixed IDs belong in privileged fixture setup. The authenticated role has a
-- deliberately narrow column grant and cannot override the generated id.
insert into public.payments (
  id, payment_item_id, currency, amount_paid, recorded_by
) values (
  '00000000-0000-0000-0000-000000243001',
  '00000000-0000-0000-0000-000000242001', 'USD', 500,
  '00000000-0000-0000-0000-000000002401'
);

select has_column('public', 'payments', 'voided_at', 'payments.voided_at exists');
select has_column('public', 'payments', 'voided_by', 'payments.voided_by exists');
select has_column('public', 'payments', 'void_reason', 'payments.void_reason exists');
select has_function('public', 'void_payment', array['uuid', 'text'], 'void_payment RPC exists');

reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000002401","role":"authenticated"}', true); end $$;

select is(
  (select status from public.payment_items where id = '00000000-0000-0000-0000-000000242001'),
  'paid', 'recorded payment marks the installment paid'
);

select is(
  public.void_payment(
    '00000000-0000-0000-0000-000000243001',
    'Bank transfer was reversed'
  ),
  '00000000-0000-0000-0000-000000243001'::uuid,
  'manager can void a payment with a reason'
);

select isnt(
  (select voided_at from public.payments where id = '00000000-0000-0000-0000-000000243001'),
  null::timestamptz, 'voided payment is timestamped'
);

select is(
  (select voided_by from public.payments where id = '00000000-0000-0000-0000-000000243001'),
  '00000000-0000-0000-0000-000000002401'::uuid,
  'the authenticated manager is recorded'
);

select is(
  (select void_reason from public.payments where id = '00000000-0000-0000-0000-000000243001'),
  'Bank transfer was reversed', 'void reason is retained for audit'
);

select is(
  (select status from public.payment_items where id = '00000000-0000-0000-0000-000000242001'),
  'pending', 'voiding removes the payment from installment totals'
);

select throws_ok(
  $$ select public.void_payment(
       '00000000-0000-0000-0000-000000243001', 'again'
     ) $$,
  'P0002', 'payment_not_found', 'an already voided payment cannot be voided twice'
);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000002402","role":"authenticated"}', true); end $$;

select is_empty(
  $$ select 1 from public.payments
      where id = '00000000-0000-0000-0000-000000243001' $$,
  'client cannot see a voided receipt'
);

select throws_ok(
  $$ select public.void_payment(
       '00000000-0000-0000-0000-000000243001', 'client attempt'
     ) $$,
  '42501', 'permission_denied', 'client cannot call void_payment'
);

select * from finish();
rollback;
