create extension if not exists vector;

create table if not exists public.content_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  source_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.content_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists content_chunks_embedding_idx
  on public.content_chunks using hnsw (embedding vector_cosine_ops);
