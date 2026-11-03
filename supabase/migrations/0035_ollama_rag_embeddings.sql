-- Use a shared 768-dimensional vector size for Ollama and Gemini embeddings.
drop function if exists public.match_knowledge_chunks(
  text, extensions.vector(1536), integer, double precision, text
);

drop index if exists public.knowledge_chunks_embedding_idx;

alter table public.knowledge_chunks
  alter column embedding type extensions.vector(768)
  using null::extensions.vector(768);

create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

create function public.match_knowledge_chunks(
  query_text         text,
  query_embedding    extensions.vector(768),
  match_count        integer default 6,
  min_similarity     double precision default 0.3,
  filter_locale      text default null
)
returns table (
  chunk_id           bigint,
  document_id        uuid,
  document_title     text,
  source_type        text,
  chunk_index        integer,
  content            text,
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
  else
    v_tsquery := null;
  end if;

  return query
  select
    kc.id                                                 as chunk_id,
    kd.id                                                 as document_id,
    kd.title                                              as document_title,
    kd.source_type                                        as source_type,
    kc.chunk_index                                        as chunk_index,
    kc.content                                            as content,
    kc.locale                                             as locale,
    case
      when query_embedding is not null and kc.embedding is not null
        then (1 - (kc.embedding <=> query_embedding))::float8
      else 0.0::float8
    end                                                   as similarity,
    (
      case
        when query_embedding is not null and kc.embedding is not null
          then (0.7 * (1 - (kc.embedding <=> query_embedding)))
        else 0.0
      end +
      (0.3 * (
        case
          when v_tsquery is not null and kc.tsv @@ v_tsquery
            then ts_rank_cd(kc.tsv, v_tsquery)
          when query_text is not null
            then extensions.similarity(kc.content, query_text)
          else 0.0
        end
      ))
    )::float8                                             as combined_score
  from public.knowledge_chunks kc
  join public.knowledge_documents kd on kd.id = kc.document_id
  where kd.is_active = true
    and (filter_locale is null or kc.locale = filter_locale)
    and (
      query_embedding is null
      or kc.embedding is null
      or (1 - (kc.embedding <=> query_embedding)) >= min_similarity
      or (v_tsquery is not null and kc.tsv @@ v_tsquery)
    )
  order by combined_score desc
  limit match_count;
end;
$$;

grant execute on function public.match_knowledge_chunks(
  text, extensions.vector(768), integer, double precision, text
) to ai_service, authenticated;
