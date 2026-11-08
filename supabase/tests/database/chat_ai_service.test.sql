-- chat_ai_service.test.sql
-- pgTAP tests for 0018_chat_tables & 0019_ai_service_role:
--   schema checks (meeting_types, chat_sessions, chat_messages, booking_proposals)
--   cascade deletion of messages and proposals
--   hybrid search function match_knowledge_chunks
--   ai_service role allowed operations (chat, leads, knowledge, estimator)
--   ai_service role STRICT ISOLATION from client confidential data (clients, projects, payments, notes)
--   staff RLS for chat logs

begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

-- ============================================================= test data

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001801', 'chat-pm@test.local'),
  ('00000000-0000-0000-0000-000000001802', 'chat-dev@test.local');

-- PM has leads.read + leads.manage
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-000000001801', id from public.roles where key = 'project_manager';

-- Dev has projects.update, NOT leads.read
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-000000001802', id from public.roles where key = 'developer';

-- Seed client and project for isolation testing
insert into public.clients (id, full_name, email, stage, source) values
  ('00000000-0000-0000-0000-0000000018c1', 'Private Client', 'priv@test.local', 'active', 'website');

insert into public.projects (id, client_id, title, created_by) values
  ('00000000-0000-0000-0000-000000001810', '00000000-0000-0000-0000-0000000018c1',
   'Confidential Project', '00000000-0000-0000-0000-000000001801');

-- Seed a test knowledge document & chunk
insert into public.knowledge_documents
  (id, source_type, title, locale, content_hash, visibility)
values
  ('00000000-0000-0000-0000-0000000018d1', 'policy',
   'Privacy and AI Guidelines', 'en', 'hash123', 'public'),
  ('00000000-0000-0000-0000-0000000018d2', 'policy',
   'Internal Operations', 'en', 'hash-private', 'private');

insert into public.knowledge_chunks (document_id, chunk_index, content, locale) values
  ('00000000-0000-0000-0000-0000000018d1', 0,
   'Reverse Cloud develops custom web software and cloud solutions.', 'en'),
  ('00000000-0000-0000-0000-0000000018d2', 0,
   'Confidential internal deployment instructions.', 'en');

-- ============================================================= schema checks

select has_column('public', 'meeting_types', 'id',           'meeting_types.id exists');
select has_column('public', 'meeting_types', 'key',          'meeting_types.key exists');
select has_column('public', 'meeting_types', 'duration_min', 'meeting_types.duration_min exists');
select has_column('public', 'meeting_types', 'is_active',    'meeting_types.is_active exists');

select has_column('public', 'chat_sessions', 'id',           'chat_sessions.id exists');
select has_column('public', 'chat_sessions', 'locale',       'chat_sessions.locale exists');
select has_column('public', 'chat_sessions', 'status',       'chat_sessions.status exists');
select has_column('public', 'chat_sessions', 'expires_at',   'chat_sessions.expires_at exists');

select has_column('public', 'chat_messages', 'id',           'chat_messages.id exists');
select has_column('public', 'chat_messages', 'session_id',   'chat_messages.session_id exists');
select has_column('public', 'chat_messages', 'role',         'chat_messages.role exists');
select has_column('public', 'chat_messages', 'content',      'chat_messages.content exists');

select has_column('public', 'booking_proposals', 'id',         'booking_proposals.id exists');
select has_column('public', 'booking_proposals', 'session_id', 'booking_proposals.session_id exists');
select has_column('public', 'booking_proposals', 'starts_at',  'booking_proposals.starts_at exists');
select has_column('public', 'booking_proposals', 'ends_at',    'booking_proposals.ends_at exists');
select has_column('public', 'booking_proposals', 'status',     'booking_proposals.status exists');

-- ============================================================= constraints & cascade

-- Ends_at before starts_at rejected
select throws_ok(
  $$ insert into public.booking_proposals (session_id, meeting_type_id, starts_at, ends_at, timezone)
     values (gen_random_uuid(),
             (select id from public.meeting_types where key = 'discovery_call'),
             now(), now() - interval '1 hour', 'Asia/Dhaka') $$,
  '23514',
  null,
  'booking proposal ends_at before starts_at rejected'
);

-- Cascade deletion of messages when session is deleted
insert into public.chat_sessions (id, locale) values
  ('00000000-0000-0000-0000-000000001820', 'en');

insert into public.chat_messages (id, session_id, role, content) values
  ('00000000-0000-0000-0000-000000001830', '00000000-0000-0000-0000-000000001820', 'user', 'Hello AI');

delete from public.chat_sessions where id = '00000000-0000-0000-0000-000000001820';

select is_empty(
  $$ select 1 from public.chat_messages where id = '00000000-0000-0000-0000-000000001830' $$,
  'chat message is cascade deleted with session'
);

-- ============================================================= hybrid search function

select has_function('public', 'match_knowledge_chunks',
  array['text', 'extensions.vector(768)', 'integer', 'double precision', 'text', 'boolean'],
  'match_knowledge_chunks function exists');

select isnt_empty(
  $$ select 1 from public.match_knowledge_chunks('software cloud', null, 5, 0.0, 'en') $$,
  'match_knowledge_chunks returns results for keyword match'
);

select is_empty(
  $$ select 1
     from public.match_knowledge_chunks('internal deployment', null, 50, 0.0, 'en')
     where document_id = '00000000-0000-0000-0000-0000000018d2' $$,
  'match_knowledge_chunks excludes private knowledge by default'
);

-- ============================================================= ai_service role: allowed actions

reset role;
set local role ai_service;

-- Can read knowledge documents
select isnt_empty(
  $$ select 1 from public.knowledge_documents where id = '00000000-0000-0000-0000-0000000018d1' $$,
  'ai_service can read knowledge_documents'
);

-- Can read meeting types
select isnt_empty(
  $$ select 1 from public.meeting_types where key = 'discovery_call' $$,
  'ai_service can read meeting_types'
);

-- Can insert chat session
select lives_ok(
  $$ insert into public.chat_sessions (id, locale)
     values ('00000000-0000-0000-0000-000000001850', 'bn') $$,
  'ai_service can insert chat_sessions'
);

-- Can insert chat message
select lives_ok(
  $$ insert into public.chat_messages (session_id, role, content)
     values ('00000000-0000-0000-0000-000000001850', 'assistant', 'AI response') $$,
  'ai_service can insert chat_messages'
);

-- Can update chat session
select lives_ok(
  $$ update public.chat_sessions set status = 'closed'
     where id = '00000000-0000-0000-0000-000000001850' $$,
  'ai_service can update chat_sessions'
);

-- Can insert lead from chat
select lives_ok(
  $$ insert into public.leads (name, email, source, consent_at)
     values ('Chat Visitor', 'visitor@test.local', 'chat', now()) $$,
  'ai_service can insert leads'
);

-- ============================================================= ai_service role: STRICT SECURITY ISOLATION

-- CANNOT read clients
select throws_ok(
  $$ select 1 from public.clients $$,
  '42501',
  null,
  'ai_service CANNOT select from clients (permission denied)'
);

-- CANNOT insert clients
select throws_ok(
  $$ insert into public.clients (full_name, email, source) values ('Sneak', 'sneak@test.local', 'website') $$,
  '42501',
  null,
  'ai_service CANNOT insert into clients'
);

-- CANNOT read projects
select throws_ok(
  $$ select 1 from public.projects $$,
  '42501',
  null,
  'ai_service CANNOT select from projects'
);

-- CANNOT read payments
select throws_ok(
  $$ select 1 from public.payments $$,
  '42501',
  null,
  'ai_service CANNOT select from payments'
);

-- CANNOT read internal notes
select throws_ok(
  $$ select 1 from public.internal_notes $$,
  '42501',
  null,
  'ai_service CANNOT select from internal_notes'
);

-- ============================================================= staff RLS on chat

-- PM has leads.read -> can read chat sessions
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001801","role":"authenticated"}', true); end $$;

select isnt_empty(
  $$ select 1 from public.chat_sessions where id = '00000000-0000-0000-0000-000000001850' $$,
  'PM with leads.read can view chat sessions'
);

-- Developer does NOT have leads.read -> sees 0 sessions
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001802","role":"authenticated"}', true); end $$;

select is_empty(
  $$ select 1 from public.chat_sessions where id = '00000000-0000-0000-0000-000000001850' $$,
  'developer without leads.read CANNOT view chat sessions'
);

reset role;
select * from finish();
rollback;
