-- Only explicitly public knowledge may be returned to the website AI.
alter table public.knowledge_documents
  add column visibility text not null default 'private'
  check (visibility in ('public', 'private'));

update public.knowledge_documents
set visibility = 'public'
where source_type in ('service', 'faq', 'portfolio', 'blog');

drop function if exists public.match_knowledge_chunks(
  text, extensions.vector(768), integer, double precision, text
);

create or replace function public.match_knowledge_chunks(
  query_text         text,
  query_embedding    extensions.vector(768),
  match_count        integer default 6,
  min_similarity     double precision default 0.3,
  filter_locale      text default null,
  public_only        boolean default true
)
returns table (
  chunk_id           bigint,
  document_id        uuid,
  document_title     text,
  source_type        text,
  chunk_index        integer,
  content            text,
  metadata           jsonb,
  locale             text,
  similarity         double precision,
  combined_score     double precision
)
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $$
declare
  v_tsquery tsquery;
begin
  if query_text is not null and char_length(btrim(query_text)) > 0 then
    v_tsquery := plainto_tsquery('simple', query_text);
  end if;

  return query
  select
    kc.id,
    kd.id,
    kd.title,
    kd.source_type,
    kc.chunk_index,
    kc.content,
    kc.metadata,
    kc.locale,
    case when query_embedding is not null and kc.embedding is not null
      then (1 - (kc.embedding <=> query_embedding))::float8 else 0.0::float8 end,
    (
      case when query_embedding is not null and kc.embedding is not null
        then 0.7 * (1 - (kc.embedding <=> query_embedding)) else 0.0 end
      + 0.3 * case
        when v_tsquery is not null and kc.tsv @@ v_tsquery then ts_rank_cd(kc.tsv, v_tsquery)
        when query_text is not null then extensions.similarity(kc.content, query_text)
        else 0.0 end
    )::float8
  from public.knowledge_chunks kc
  join public.knowledge_documents kd on kd.id = kc.document_id
  where kd.is_active = true
    and (not public_only or kd.visibility = 'public')
    and (filter_locale is null or kc.locale = filter_locale)
    and (
      query_embedding is null
      or kc.embedding is null
      or (1 - (kc.embedding <=> query_embedding)) >= min_similarity
      or (v_tsquery is not null and kc.tsv @@ v_tsquery)
    )
  order by 10 desc
  limit match_count;
end;
$$;

grant execute on function public.match_knowledge_chunks(
  text, extensions.vector(768), integer, double precision, text, boolean
) to ai_service, authenticated;
