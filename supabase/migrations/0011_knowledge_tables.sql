-- 0011_knowledge_tables
-- Knowledge base for the AI agent (plan sections 5.3-F and 8.4).
-- Replaces the early prototype tables content_documents / content_chunks.
--
-- A document is one piece of source content in one language (a service, FAQ,
-- portfolio item, blog post, or a hand-written policy). It is split into
-- chunks, and each chunk has an embedding for similarity search.
-- Row Level Security is switched ON here. Staff with content.manage can read and
-- write. The AI service gets its own limited database role in a later migration.
--
-- EMBED_DIM is 1536. It must stay <= 2000 for an HNSW index to work, and
-- changing it later means re-embedding everything.

create table public.knowledge_documents (
  id           uuid primary key default gen_random_uuid(),
  source_type  text not null
               check (source_type in ('service', 'faq', 'portfolio', 'blog', 'policy', 'manual')),
  source_id    uuid,   -- the row this came from; no foreign key because it can point to different tables
  title        text not null,
  locale       text not null default 'en' check (locale in ('en', 'bn')),
  content_hash text not null,   -- lets the ingestion skip text that has not changed
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Everything except hand-written documents must point to its source.
  constraint knowledge_source_id_rule
    check (source_type in ('policy', 'manual') or source_id is not null)
);

-- One document per source and language.
create unique index knowledge_documents_one_per_source
  on public.knowledge_documents (source_type, source_id, locale)
  where source_id is not null;

create index knowledge_documents_active_idx
  on public.knowledge_documents (is_active, locale);

create trigger knowledge_documents_set_updated_at
  before update on public.knowledge_documents
  for each row execute function app.set_updated_at();

create table public.knowledge_chunks (
  id          bigint generated always as identity primary key,
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content     text not null,
  locale      text not null default 'en' check (locale in ('en', 'bn')),
  embedding   extensions.vector(1536),
  token_count integer check (token_count >= 0),
  metadata    jsonb not null default '{}'::jsonb,
  -- Keyword search. The "simple" setting is deliberate: Postgres has no Bangla
  -- stemmer, and the embeddings do the heavy lifting for meaning.
  tsv         tsvector generated always as (to_tsvector('simple', content)) stored,
  created_at  timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- Similarity search (cosine).
create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- Keyword search and fuzzy text search.
create index knowledge_chunks_tsv_idx
  on public.knowledge_chunks using gin (tsv);
create index knowledge_chunks_content_trgm_idx
  on public.knowledge_chunks using gin (content extensions.gin_trgm_ops);

-- ------------------------------------------------------- Row Level Security
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks    enable row level security;

create policy "knowledge_documents: staff manage"
  on public.knowledge_documents for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

create policy "knowledge_chunks: staff manage"
  on public.knowledge_chunks for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));