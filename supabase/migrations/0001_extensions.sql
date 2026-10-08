-- 0001_extensions
-- Database add-ons used across the project (plan section 5.1).
-- Most live in the "extensions" schema to keep "public" clean.

create extension if not exists pgcrypto with schema extensions;  -- hashing (invite tokens)
create extension if not exists citext   with schema extensions;  -- case-insensitive text (emails)
create extension if not exists pg_trgm  with schema extensions;  -- fuzzy text search
create extension if not exists vector   with schema extensions;  -- AI search (RAG)

-- Scheduled jobs (nightly purge, expiring proposals). Supabase installs this in pg_catalog.
create extension if not exists pg_cron  with schema pg_catalog;