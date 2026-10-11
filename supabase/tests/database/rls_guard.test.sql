-- rls_guard.test.sql
-- Fails if any table in the public schema has Row Level Security switched off.
-- A new table must either have RLS on, or be listed on purpose in the
-- exceptions below (currently none).

begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select is_empty(
  $$ select tablename from pg_tables
      where schemaname = 'public' and not rowsecurity
        and tablename not in ('')   -- add a table name here only if it is meant to be open
      order by 1 $$,
  'every table in the public schema has row level security on');

select * from finish();
rollback;