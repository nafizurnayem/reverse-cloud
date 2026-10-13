-- client_invites.test.sql
-- Automatic tests for migration 0014_client_invites.sql: invite storage, the four
-- functions (create, accept, link, revoke) and who may call them.
-- Everything runs inside one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(62);

-- ============================================================ test data
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d2', 'inv-pm@test.local',   now(), null),
  ('00000000-0000-0000-0000-0000000000d3', 'inv-dev@test.local',  now(), null),
  ('00000000-0000-0000-0000-0000000000d4', 'invitee@example.com', now(), null),
  ('00000000-0000-0000-0000-0000000000d5', 'other@example.com',   now(), null),
  ('00000000-0000-0000-0000-0000000000d6', 'unconf@example.com',  null,  null),
  ('00000000-0000-0000-0000-0000000000d7', 'new@example.com',     now(), '{"full_name":"New Person"}'),
  ('00000000-0000-0000-0000-0000000000d8', 'match@example.com',   now(), null),
  ('00000000-0000-0000-0000-0000000000d9', 'taken@example.com',   now(), null),
  ('00000000-0000-0000-0000-0000000000da', 'owner@test.local',    now(), null),
  ('00000000-0000-0000-0000-0000000000db', 'plain.person@example.com', now(), null);

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000d2', id from public.roles where key = 'project_manager';
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000d3', id from public.roles where key = 'developer';

insert into public.clients (id, user_id, full_name, email) values
  ('00000000-0000-0000-0000-00000000b001', null, 'Invited client',     'invited-client@example.com'),
  ('00000000-0000-0000-0000-00000000b002', null, 'Second client',      null),
  ('00000000-0000-0000-0000-00000000b003', null, 'Matching client',    'match@example.com'),
  ('00000000-0000-0000-0000-00000000b004', '00000000-0000-0000-0000-0000000000da',
                                              'Taken client',        'taken@example.com'),
  ('00000000-0000-0000-0000-00000000b006', null, 'Direct insert client', null),
  ('00000000-0000-0000-0000-00000000b007', null, 'Expired client',     null),
  ('00000000-0000-0000-0000-00000000b008', null, 'Other client',       null),
  ('00000000-0000-0000-0000-00000000b009', null, 'Unconfirmed client', null),
  ('00000000-0000-0000-0000-00000000b010', null, 'Revoked client',     null);

-- ===================================================== structure and rules
select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public' and rowsecurity and tablename = 'client_invites'),
  1, 'row level security is on for client_invites');

select throws_ok(
  $$ insert into public.client_invites (client_id, email, token_hash, expires_at) values
       ('00000000-0000-0000-0000-00000000b006', 'x@example.com', repeat('a', 64), now() + interval '1 day'),
       ('00000000-0000-0000-0000-00000000b006', 'x@example.com', repeat('b', 64), now() + interval '1 day') $$,
  '23505', null, 'a client can have only one open invite');

select throws_ok(
  $$ insert into public.client_invites (client_id, email, token_hash, expires_at)
     values ('00000000-0000-0000-0000-00000000b006', 'x@example.com', 'short', now() + interval '1 day') $$,
  '23514', null, 'a token hash must be 64 characters');

select throws_ok(
  $$ insert into public.client_invites (client_id, email, token_hash, expires_at)
     values ('00000000-0000-0000-0000-00000000b006', 'x@example.com', repeat('c', 64), now() - interval '1 day') $$,
  '23514', null, 'an invite cannot expire before it was created');

select throws_ok(
  $$ insert into public.client_invites (client_id, email, token_hash, expires_at, accepted_at, revoked_at)
     values ('00000000-0000-0000-0000-00000000b006', 'x@example.com', repeat('d', 64),
             now() + interval '1 day', now(), now()) $$,
  '23514', null, 'an invite cannot be both accepted and revoked');

select throws_ok(
  $$ insert into public.client_invites (client_id, email, token_hash, expires_at)
     values ('00000000-0000-0000-0000-00000000b006', 'not-an-email', repeat('e', 64), now() + interval '1 day') $$,
  '23514', null, 'an invite email must look like an email');

select has_function('public', 'create_client_invite', array['uuid', 'text', 'boolean'],
  'create_client_invite exists');
select has_function('public', 'accept_client_invite', array['text'],
  'accept_client_invite exists');
select has_function('public', 'link_my_client_account', array[]::text[],
  'link_my_client_account exists');
select has_function('public', 'revoke_client_invite', array['uuid'],
  'revoke_client_invite exists');

select is(
  (select bool_or(has_function_privilege('anon', f, 'execute'))
     from unnest(array[
       'public.create_client_invite(uuid, text, boolean)',
       'public.accept_client_invite(text)',
       'public.link_my_client_account()',
       'public.revoke_client_invite(uuid)']) f),
  false, 'visitors cannot run any invite function');

select is(
  (select bool_and(has_function_privilege('authenticated', f, 'execute'))
     from unnest(array[
       'public.create_client_invite(uuid, text, boolean)',
       'public.accept_client_invite(text)',
       'public.link_my_client_account()',
       'public.revoke_client_invite(uuid)']) f),
  true, 'signed-in users can run the invite functions');

-- ============================================== a visitor (not signed in)
set local role anon;

select throws_ok(
  $$ select count(*) from public.client_invites $$,
  '42501', null, 'visitor cannot read invites');
select throws_ok(
  $$ select public.accept_client_invite('anything') $$,
  '42501', null, 'visitor cannot accept an invite');

-- ================================================================ a developer
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
end $$;

select throws_ok(
  $$ select * from public.create_client_invite('00000000-0000-0000-0000-00000000b001', 'invitee@example.com') $$,
  '42501', null, 'a developer cannot create an invite');
select throws_ok(
  $$ select public.revoke_client_invite('00000000-0000-0000-0000-00000000ffff') $$,
  '42501', null, 'a developer cannot revoke an invite');

-- ====================================================== a project manager
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
end $$;

-- Create the invites used by the later steps. The raw tokens are kept in
-- session settings so the tests can use them.
select set_config('rc.tok_a', (select token from public.create_client_invite(
  '00000000-0000-0000-0000-00000000b001', 'invitee@example.com')), true);

select is(
  (select count(*)::int from public.client_invites
    where client_id = '00000000-0000-0000-0000-00000000b001' and revoked_at is null),
  1, 'creating an invite leaves one open invite');

select set_config('rc.tok_a2', (select token from public.create_client_invite(
  '00000000-0000-0000-0000-00000000b001', 'invitee@example.com')), true);

select is(
  (select count(*)::int from public.client_invites
    where client_id = '00000000-0000-0000-0000-00000000b001' and revoked_at is not null),
  1, 'a new invite closes the older open one');

select is(
  (select count(*)::int from public.client_invites
    where client_id = '00000000-0000-0000-0000-00000000b001' and revoked_at is null),
  1, 'only the newest invite stays open');

select is(length(current_setting('rc.tok_a2')), 43, 'the token is 43 characters long');

select set_config('rc.tok_b', (select token from public.create_client_invite(
  '00000000-0000-0000-0000-00000000b002', 'invitee@example.com')), true);
select set_config('rc.tok_c', (select token from public.create_client_invite(
  '00000000-0000-0000-0000-00000000b007', 'invitee@example.com')), true);
select set_config('rc.tok_d', (select token from public.create_client_invite(
  '00000000-0000-0000-0000-00000000b008', 'other@example.com')), true);
select set_config('rc.tok_e', (select token from public.create_client_invite(
  '00000000-0000-0000-0000-00000000b009', 'unconf@example.com')), true);
select set_config('rc.tok_f', (select token from public.create_client_invite(
  '00000000-0000-0000-0000-00000000b010', 'invitee@example.com')), true);
select set_config('rc.tok_g', (select token from public.create_client_invite(
  '00000000-0000-0000-0000-00000000b003', 'match@example.com')), true);

select ok(
  (select count(*) from public.client_invites) >= 7,
  'a project manager can read invites');

select throws_ok(
  $$ select token_hash from public.client_invites $$,
  '42501', null, 'nobody can read token hashes through the app');
select throws_ok(
  $$ insert into public.client_invites (client_id, email, token_hash, expires_at)
     values ('00000000-0000-0000-0000-00000000b006', 'x@example.com', repeat('a', 64), now() + interval '1 day') $$,
  '42501', null, 'staff cannot insert invites directly');
select throws_ok(
  $$ update public.client_invites set expires_at = now() + interval '365 days' $$,
  '42501', null, 'staff cannot edit invites directly');
select throws_ok(
  $$ delete from public.client_invites $$,
  '42501', null, 'staff cannot delete invites');

select throws_ok(
  $$ select * from public.create_client_invite('00000000-0000-0000-0000-00000000b002', 'x@example.com', true) $$,
  '0A000', 'email_delivery_not_enabled', 'sending the invite by email is switched off');
select throws_ok(
  $$ select * from public.create_client_invite('00000000-0000-0000-0000-00000000b002', 'nope') $$,
  '22023', 'invalid_invite_email', 'an invite needs a valid email');
select throws_ok(
  $$ select * from public.create_client_invite('00000000-0000-0000-0000-00000000ffff', 'x@example.com') $$,
  'P0002', 'client_not_found', 'an invite needs an existing client');
select throws_ok(
  $$ select * from public.create_client_invite('00000000-0000-0000-0000-00000000b004', 'x@example.com') $$,
  '55000', 'client_already_linked', 'a client that already has an account cannot be invited');

select is(
  public.revoke_client_invite((select id from public.client_invites
    where client_id = '00000000-0000-0000-0000-00000000b010' and revoked_at is null)),
  true, 'revoking an open invite returns true');
select is(
  public.revoke_client_invite((select id from public.client_invites
    where client_id = '00000000-0000-0000-0000-00000000b010')),
  false, 'revoking an already closed invite returns false');
select is(
  public.revoke_client_invite('00000000-0000-0000-0000-00000000ffff'),
  false, 'revoking an unknown invite returns false');

-- ============================================ checks as the database owner
reset role;

-- Make the invite for client 7 old and expired.
update public.client_invites
   set created_at = now() - interval '20 days', expires_at = now() - interval '6 days'
 where client_id = '00000000-0000-0000-0000-00000000b007';

select is(
  (select token_hash from public.client_invites
    where client_id = '00000000-0000-0000-0000-00000000b001' and revoked_at is null),
  encode(extensions.digest(current_setting('rc.tok_a2'), 'sha256'), 'hex'),
  'only the hash of the token is stored');

select is(
  (select count(*)::int from public.client_invites
    where token_hash = current_setting('rc.tok_a2')),
  0, 'the raw token itself is never stored');

select is(
  (select expires_at between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour'
     from public.client_invites
    where client_id = '00000000-0000-0000-0000-00000000b001' and revoked_at is null),
  true, 'an invite expires after 14 days');

-- ========================================== accepting, as the invited person
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
end $$;

select throws_ok(
  $$ select public.accept_client_invite(current_setting('rc.tok_a')) $$,
  'P0001', 'invalid_or_expired_invite', 'a replaced invite cannot be used');
select throws_ok(
  $$ select public.accept_client_invite('not-a-real-token') $$,
  'P0001', 'invalid_or_expired_invite', 'an unknown token is refused');
select throws_ok(
  $$ select public.accept_client_invite(null) $$,
  'P0001', 'invalid_or_expired_invite', 'an empty token is refused');
select throws_ok(
  $$ select public.accept_client_invite(current_setting('rc.tok_d')) $$,
  'P0001', 'invalid_or_expired_invite', 'an invite for a different email cannot be used');
select throws_ok(
  $$ select public.accept_client_invite(current_setting('rc.tok_c')) $$,
  'P0001', 'invalid_or_expired_invite', 'an expired invite cannot be used');
select throws_ok(
  $$ select public.accept_client_invite(current_setting('rc.tok_f')) $$,
  'P0001', 'invalid_or_expired_invite', 'a revoked invite cannot be used');

select is(
  public.accept_client_invite(current_setting('rc.tok_a2')),
  '00000000-0000-0000-0000-00000000b001'::uuid,
  'accepting a valid invite returns the client');
select is(
  public.accept_client_invite(current_setting('rc.tok_a2')),
  '00000000-0000-0000-0000-00000000b001'::uuid,
  'accepting again as the same person returns the same client');
select is(app.my_client_id(), '00000000-0000-0000-0000-00000000b001'::uuid,
  'after accepting, my_client_id finds the client');
select throws_ok(
  $$ select public.accept_client_invite(current_setting('rc.tok_b')) $$,
  'P0001', 'invalid_or_expired_invite', 'someone already linked to a client cannot take a second one');

reset role;

select is(
  (select user_id from public.clients where id = '00000000-0000-0000-0000-00000000b001'),
  '00000000-0000-0000-0000-0000000000d4'::uuid, 'the client is now linked to the account');
select is(
  (select accepted_by from public.client_invites
    where client_id = '00000000-0000-0000-0000-00000000b001' and accepted_at is not null),
  '00000000-0000-0000-0000-0000000000d4'::uuid, 'the invite records who accepted it');

-- ======================================== another person cannot reuse it
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d5","role":"authenticated"}', true);
end $$;

select throws_ok(
  $$ select public.accept_client_invite(current_setting('rc.tok_a2')) $$,
  'P0001', 'invalid_or_expired_invite', 'a used invite cannot be used by someone else');
select is(
  public.accept_client_invite(current_setting('rc.tok_d')),
  '00000000-0000-0000-0000-00000000b008'::uuid,
  'the person the invite was sent to can accept it');

-- ================================================ an unconfirmed email
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d6","role":"authenticated"}', true);
end $$;

select throws_ok(
  $$ select public.accept_client_invite(current_setting('rc.tok_e')) $$,
  'P0001', 'invalid_or_expired_invite', 'an unconfirmed email cannot accept an invite');
select throws_ok(
  $$ select public.link_my_client_account() $$,
  'P0001', 'email_not_confirmed', 'an unconfirmed email cannot be linked to a client');

-- ================================================= linking after sign-in
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d7","role":"authenticated"}', true);
end $$;

select set_config('rc.link7', public.link_my_client_account()::text, true);
select is(public.link_my_client_account()::text, current_setting('rc.link7'),
  'linking twice returns the same client');

reset role;
select is(
  (select full_name || '|' || stage || '|' || source
     from public.clients where user_id = '00000000-0000-0000-0000-0000000000d7'),
  'New Person|prospect|website',
  'a new account gets a prospect client using its name');
select is(
  (select count(*)::int from public.clients where email = 'new@example.com'),
  1, 'linking twice does not create two clients');

set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000db","role":"authenticated"}', true);
end $$;
select isnt(public.link_my_client_account(), null::uuid, 'an account with no name still gets a client');
reset role;
select is(
  (select full_name from public.clients where user_id = '00000000-0000-0000-0000-0000000000db'),
  'plain.person', 'without a name, the first part of the email is used');

set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d8","role":"authenticated"}', true);
end $$;
select is(public.link_my_client_account(), '00000000-0000-0000-0000-00000000b003'::uuid,
  'an account with a matching email is linked to the existing client');
select is(
  public.accept_client_invite(current_setting('rc.tok_g')),
  '00000000-0000-0000-0000-00000000b003'::uuid,
  'accepting an invite for a client already linked to you returns that client');

reset role;
select isnt(
  (select accepted_at from public.client_invites
    where client_id = '00000000-0000-0000-0000-00000000b003'),
  null::timestamptz, 'that invite is now closed');

set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d9","role":"authenticated"}', true);
end $$;
select throws_ok(
  $$ select public.link_my_client_account() $$,
  'P0001', 'email_already_linked', 'an email owned by a client linked to someone else is refused');

do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
end $$;
select is(public.link_my_client_account(), '00000000-0000-0000-0000-00000000b001'::uuid,
  'an account that is already linked gets its existing client back');

-- ======================================== staff cannot revoke an accepted invite
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
end $$;
select is(
  public.revoke_client_invite((select id from public.client_invites
    where client_id = '00000000-0000-0000-0000-00000000b001' and accepted_at is not null)),
  false, 'an accepted invite cannot be revoked');

-- ================================================================== done
reset role;
select * from finish();
rollback;
