-- content.test.sql
-- Automatic tests for migrations 0006-0007 (public content and its access rules).
-- Everything runs inside one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ============================================================ test data
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'admin2@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'pm@test.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'user@test.local');

insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000c1', id from public.roles where key = 'admin';
insert into public.staff_roles (user_id, role_id)
select '00000000-0000-0000-0000-0000000000c2', id from public.roles where key = 'project_manager';

insert into public.services (slug, name_en, summary_en, body_en, is_published, archived_at) values
  ('web-dev',   'Web development', 'Summary', 'Body', true,  null),
  ('draft-svc', 'Draft service',   null,      null,   false, null),
  ('old-svc',   'Old service',     'Summary', 'Body', true,  now());

insert into public.faqs (service_id, question_en, answer_en, is_published) values
  (null, 'General question', 'Answer', true),
  ((select id from public.services where slug = 'draft-svc'), 'Hidden by service', 'Answer', true),
  (null, 'Unpublished question', 'Answer', false);

insert into public.portfolio_items (slug, title_en, summary_en, client_consent, is_published) values
  ('case-a', 'Case A', 'Summary', true,  true),
  ('case-b', 'Case B', 'Summary', false, false);

insert into public.portfolio_media (portfolio_item_id, storage_path)
select id, 'media/' || slug || '.jpg' from public.portfolio_items;

insert into public.portfolio_services (portfolio_item_id, service_id)
select p.id, (select id from public.services where slug = 'web-dev')
from public.portfolio_items p;

insert into public.blog_posts (slug, title_en, body_en, status, published_at) values
  ('post-a', 'Post A', 'Body', 'published', now());
insert into public.blog_posts (slug, status) values ('post-b', 'draft');

insert into public.reviews (reviewer_name, rating, body, status, source, project_id) values
  ('Alice', 5, 'Great work', 'approved', 'manual', null),
  ('Bob',   4, 'Good work',  'pending',  'manual', null),
  ('Carol', 5, 'Excellent',  'approved', 'portal', '00000000-0000-0000-0000-0000000000d1');

insert into public.site_settings (key, value, is_public) values
  ('contact_email', '"hello@example.com"'::jsonb, true),
  ('ai_enabled',    'true'::jsonb,                false);

-- ===================================================== structure and rules
select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public' and rowsecurity
      and tablename in ('site_settings', 'services', 'faqs', 'portfolio_items',
                        'portfolio_services', 'portfolio_media', 'blog_posts', 'reviews')),
  8, 'row level security is on for all content tables');

select throws_ok(
  $$ insert into public.portfolio_items (slug, title_en, summary_en, is_published, client_consent)
     values ('bad', 'Bad', 'Summary', true, false) $$,
  '23514', null, 'a portfolio item cannot be published without client consent');

select throws_ok(
  $$ insert into public.blog_posts (slug, status, title_en)
     values ('bad-post', 'published', 'No body') $$,
  '23514', null, 'a blog post cannot be published without an English body');

select throws_ok(
  $$ insert into public.services (slug, name_en, is_published)
     values ('bad-svc', 'Bad', true) $$,
  '23514', null, 'a service cannot be published without English text');

select throws_ok(
  $$ insert into public.reviews (reviewer_name, rating, body)
     values ('Dan', 6, 'Too high') $$,
  '23514', null, 'a rating must be between 1 and 5');

select throws_ok(
  $$ insert into public.reviews (reviewer_name, rating, body, source, project_id)
     values ('Eve', 5, 'Again', 'portal', '00000000-0000-0000-0000-0000000000d1') $$,
  '23505', null, 'a project can have only one portal review');

-- ================================================= a visitor (not signed in)
set local role anon;

select is((select count(*)::int from public.services), 1,
  'visitor sees only the published, non-archived service');
select is((select count(*)::int from public.faqs), 1,
  'visitor does not see FAQs that are unpublished or tied to a hidden service');
select is((select count(*)::int from public.portfolio_items), 1,
  'visitor sees only the published portfolio item');
select is((select count(*)::int from public.portfolio_media), 1,
  'visitor sees media only for the published portfolio item');
select is((select count(*)::int from public.portfolio_services), 1,
  'visitor sees service links only for the published portfolio item');
select is((select count(*)::int from public.blog_posts), 1,
  'visitor sees only published blog posts');
select is((select count(*)::int from public.reviews), 2,
  'visitor sees only approved reviews');
select is((select count(*)::int from public.site_settings), 1,
  'visitor sees only public settings');
select is((select key from public.site_settings), 'contact_email',
  'the visible setting is the public one');
select throws_ok(
  $$ insert into public.services (slug, name_en) values ('hack', 'Hack') $$,
  '42501', null, 'visitor cannot create a service');
select is_empty(
  $$ update public.services set name_en = 'Hacked' returning 1 $$,
  'visitor cannot edit a service');

-- ==================================== a signed-in person who is not staff
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.services), 1,
  'a normal user sees only the published service');
select throws_ok(
  $$ insert into public.services (slug, name_en) values ('hack2', 'Hack') $$,
  '42501', null, 'a normal user cannot create a service');
select throws_ok(
  $$ insert into public.reviews (reviewer_name, rating, body)
     values ('Mallory', 5, 'Fake') $$,
  '42501', null, 'a normal user cannot insert a review yet');

-- ====================================================== a project manager
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
end $$;

select throws_ok(
  $$ insert into public.services (slug, name_en) values ('pm-svc', 'PM service') $$,
  '42501', null, 'a project manager cannot edit content');
select is((select count(*)::int from public.reviews), 3,
  'a project manager sees pending reviews too');
select lives_ok(
  $$ update public.reviews
        set status = 'approved',
            moderated_by = '00000000-0000-0000-0000-0000000000c2',
            moderated_at = now()
      where reviewer_name = 'Bob' $$,
  'a project manager can approve a review');
select is(
  (select count(*)::int from public.reviews where status = 'approved'), 3,
  'the approval was saved');
select is_empty(
  $$ delete from public.reviews returning 1 $$,
  'nobody can delete a review');
select is((select count(*)::int from public.services), 1,
  'a project manager does not see draft or archived services');

-- ================================================================ an admin
reset role;
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
end $$;

select is((select count(*)::int from public.services), 3,
  'admin sees draft and archived services');
select lives_ok(
  $$ insert into public.services (slug, name_en) values ('new-svc', 'New service') $$,
  'admin can create a service');
select is((select count(*)::int from public.site_settings), 2,
  'admin sees private settings');
select lives_ok(
  $$ insert into public.blog_posts (slug, status) values ('admin-draft', 'draft') $$,
  'admin can create a blog draft');
select throws_ok(
  $$ update public.portfolio_items set is_published = true where slug = 'case-b' $$,
  '23514', null, 'even an admin cannot publish without client consent');
select is(
  (select count(*)::int from public.audit_log
    where entity_type = 'reviews' and action = 'update'
      and actor_id::text = '00000000-0000-0000-0000-0000000000c2'),
  1, 'the audit log recorded who approved the review');

-- ================================================================== done
reset role;
select * from finish();
rollback;