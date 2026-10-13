-- internal_notes.test.sql
-- pgTAP tests for 0017_internal_notes:
--   schema, entity_type constraint, body constraint
--   RLS: any staff can read/insert; authors own update/delete; managers override
--   clients are completely blocked

begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ============================================================= test data

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001701', 'note-author@test.local'),
  ('00000000-0000-0000-0000-000000001702', 'note-other@test.local'),
  ('00000000-0000-0000-0000-000000001703', 'note-manager@test.local'),
  ('00000000-0000-0000-0000-000000001704', 'note-cli@test.local');

-- author and other_staff are developers (projects.update only, not staff.manage)
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-000000001701', id from public.roles where key = 'developer';

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-000000001702', id from public.roles where key = 'developer';

-- manager is admin (has staff.manage)
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-000000001703', id from public.roles where key = 'admin';

-- client record
insert into public.clients (id, user_id, full_name, email, stage, source) values
  ('00000000-0000-0000-0000-0000000017c1',
   '00000000-0000-0000-0000-000000001704',
   'Note Client', 'note-cli@test.local', 'active', 'website');

-- project
insert into public.projects (id, client_id, title, created_by) values
  ('00000000-0000-0000-0000-000000001710',
   '00000000-0000-0000-0000-0000000017c1',
   'Note Project',
   '00000000-0000-0000-0000-000000001703');

-- ============================================================= schema checks

select has_column('public', 'internal_notes', 'id',          'internal_notes.id exists');
select has_column('public', 'internal_notes', 'entity_type', 'internal_notes.entity_type exists');
select has_column('public', 'internal_notes', 'entity_id',   'internal_notes.entity_id exists');
select has_column('public', 'internal_notes', 'body',        'internal_notes.body exists');
select has_column('public', 'internal_notes', 'author_id',   'internal_notes.author_id exists');
select has_column('public', 'internal_notes', 'created_at',  'internal_notes.created_at exists');
select has_column('public', 'internal_notes', 'updated_at',  'internal_notes.updated_at exists');

-- ============================================================= check constraints

-- Invalid entity_type rejected
select throws_ok(
  $$ insert into public.internal_notes (entity_type, entity_id, body, author_id)
     values ('invoice', gen_random_uuid(), 'Bad type', null) $$,
  '23514',
  null,
  'invalid entity_type rejected by check constraint'
);

-- Empty body rejected
select throws_ok(
  $$ insert into public.internal_notes (entity_type, entity_id, body)
     values ('project', gen_random_uuid(), '   ') $$,
  '23514',
  null,
  'whitespace-only body rejected'
);

-- All valid entity_type values are accepted
do $$
declare
  v_types text[] := array['project','milestone','payment_item','payment','client','lead'];
  t text;
begin
  foreach t in array v_types loop
    insert into public.internal_notes (entity_type, entity_id, body)
    values (t, gen_random_uuid(), 'Test note for ' || t);
  end loop;
end;
$$;

select is(
  (select count(*)::int from public.internal_notes),
  6,
  'all 6 valid entity_type values accepted'
);

-- ============================================================= RLS: author (developer)

reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001701","role":"authenticated"}', true); end $$;

-- Author can read all notes (staff = true)
select is(
  (select count(*)::int from public.internal_notes),
  6,
  'staff author can read all notes'
);

-- Author can insert a note on a project
select lives_ok(
  $$ insert into public.internal_notes (entity_type, entity_id, body, author_id)
     values ('project', '00000000-0000-0000-0000-000000001710',
             'Author note', auth.uid()) $$,
  'author can insert a note'
);

-- Author can update their own note
select lives_ok(
  $$ update public.internal_notes set body = 'Updated body'
     where entity_id = '00000000-0000-0000-0000-000000001710' $$,
  'author can update their own note'
);

-- Author CANNOT reassign entity_type (column not granted)
select throws_ok(
  $$ update public.internal_notes set entity_type = 'client'
     where entity_id = '00000000-0000-0000-0000-000000001710' $$,
  '42501',
  null,
  'author cannot change entity_type (column not granted)'
);

-- Author CANNOT reassign author_id (column not granted)
select throws_ok(
  $$ update public.internal_notes set author_id = gen_random_uuid()
     where entity_id = '00000000-0000-0000-0000-000000001710' $$,
  '42501',
  null,
  'author cannot reassign author_id (column not granted)'
);

-- Author can delete their own note
select lives_ok(
  $$ delete from public.internal_notes
     where entity_id = '00000000-0000-0000-0000-000000001710' $$,
  'author can delete their own note'
);

-- Re-insert note as author for other_staff tests
select lives_ok(
  $$ insert into public.internal_notes (entity_type, entity_id, body, author_id)
     values ('project', '00000000-0000-0000-0000-000000001710',
             'Author note v2', auth.uid()) $$,
  'author can insert a second note'
);

-- ============================================================= RLS: other_staff (not author)

reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001702","role":"authenticated"}', true); end $$;

-- Other staff can read the note
select isnt_empty(
  $$ select 1 from public.internal_notes
     where entity_id = '00000000-0000-0000-0000-000000001710' $$,
  'other staff can read any note'
);

-- Other staff update touches 0 rows
select is_empty(
  $$ update public.internal_notes set body = 'Hacked'
     where entity_id = '00000000-0000-0000-0000-000000001710'
     returning 1 $$,
  'other_staff update policy excludes them'
);

-- Other staff delete touches 0 rows
select is_empty(
  $$ delete from public.internal_notes
     where entity_id = '00000000-0000-0000-0000-000000001710'
     returning 1 $$,
  'other_staff delete policy excludes them'
);

-- ============================================================= RLS: manager (staff.manage)

reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001703","role":"authenticated"}', true); end $$;

-- Manager can update any note
select lives_ok(
  $$ update public.internal_notes set body = 'Manager corrected'
     where entity_id = '00000000-0000-0000-0000-000000001710' $$,
  'manager can update any note'
);

-- Manager can delete any note
select lives_ok(
  $$ delete from public.internal_notes
     where entity_id = '00000000-0000-0000-0000-000000001710' $$,
  'manager can delete any note'
);

-- ============================================================= RLS: client (no access)

reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001704","role":"authenticated"}', true); end $$;

-- Client CANNOT read any notes
select is_empty(
  $$ select 1 from public.internal_notes $$,
  'client cannot read any internal notes'
);

-- Client CANNOT insert a note
select throws_ok(
  $$ insert into public.internal_notes (entity_type, entity_id, body)
     values ('project', '00000000-0000-0000-0000-000000001710', 'Sneaky') $$,
  '42501',
  null,
  'client cannot insert an internal note'
);

reset role;
select * from finish();
rollback;
