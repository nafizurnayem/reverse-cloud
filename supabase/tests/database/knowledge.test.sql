-- knowledge.test.sql
-- Automatic tests for migration 0011 (AI knowledge base tables).
-- Everything runs inside one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- ============================================================ test data
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'kb-admin@test.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'kb-pm@test.local');

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000f1', id from public.roles where key = 'admin';
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000f2', id from public.roles where key = 'project_manager';

insert into public.knowledge_documents (source_type, source_id, title, locale, content_hash) values
  ('service', '00000000-0000-0000-0000-0000000000a9', 'Web development', 'en', 'hash1'),
  ('policy',  null,                                   'Refund policy',   'en', 'hash2'),
  ('manual',  null,                                   'Temporary doc',   'en', 'hash3');

insert into public.knowledge_chunks (document_id, chunk_index, content)
select id, 0,
       case title when 'Web development' then 'we build fast websites'
                  when 'Refund policy'   then 'refund policy text'
                  else 'temporary text' end
from public.knowledge_documents;

-- ===================================================== structure and rules
select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public' and rowsecurity
      and tablename in ('knowledge_documents', 'knowledge_chunks')),
  2, 'row level security is on for both knowledge tables');

select throws_ok(
  $$ insert into public.knowledge_documents (source_type, title, content_hash)
     values ('newsletter', 'Bad type', 'h') $$,
  '23514', null, 'a document must have a known source type');

select throws_ok(
  $$ insert into public.knowledge_documents (source_type, title, content_hash)
     values ('service', 'No source id', 'h') $$,
  '23514', null, 'a service document must point to its source');

select throws_ok(
  $$ insert into public.knowledge_documents (source_type, source_id, title, locale, content_hash)
     values ('service', '00000000-0000-0000-0000-0000000000a9', 'Duplicate', 'en', 'h') $$,
  '23505', null, 'a source has only one document per language');

select throws_ok(
  $$ insert into public.knowledge_chunks (document_id, chunk_index, content)
     select id, 0, 'again' from public.knowledge_documents where title = 'Web development' $$,
  '23505', null, 'a document cannot have two chunks with the same index');

select ok(
  (select tsv @@ to_tsquery('simple', 'refund')
     from public.knowledge_chunks where content like 'refund%'),
  'keyword search finds a chunk');

select lives_ok(
  $$ delete from public.knowledge_documents where title = 'Temporary doc' $$,
  'a document can be deleted');
select is(
  (select count(*)::int from public.knowledge_chunks where content = 'temporary text'),
  0, 'deleting a document deletes its chunks');

-- ================================================= a visitor (not signed in)
set local role anon;

select is((select count(*)::int from public.knowledge_documents), 0,
  'visitor cannot read knowledge documents');
select is((select count(*)::int from public.knowledge_chunks), 0,
  'visitor cannot read knowledge chunks');
select throws_ok(
  $$ insert into public.knowledge_documents (source_type, title, content_hash)
     values ('manual', 'Hack', 'h') $$,
  '42501', null, 'visitor cannot write knowledge documents');

-- ====================================================== a project manager
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.knowledge_documents), 0,
  'a project manager cannot read knowledge documents');
select is((select count(*)::int from public.knowledge_chunks), 0,
  'a project manager cannot read knowledge chunks');

-- ================================================================ an admin
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.knowledge_documents), 2,
  'admin can read knowledge documents');
select is((select count(*)::int from public.knowledge_chunks), 2,
  'admin can read knowledge chunks');
select lives_ok(
  $$ insert into public.knowledge_documents (source_type, title, content_hash)
     values ('manual', 'Admin document', 'h4') $$,
  'admin can create a knowledge document');
select lives_ok(
  $$ update public.knowledge_documents set is_active = false where title = 'Refund policy' $$,
  'admin can deactivate a document');

-- ================================================================== done
reset role;
select * from finish();
rollback;