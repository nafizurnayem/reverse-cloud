-- 0019_ai_service_role
-- Dedicated Postgres role for the FastAPI service with strict least-privilege grants
-- and the hybrid vector + full-text RAG search function (plan sections 5.3, 5.5, 8.4).
--
-- SECURITY BOUNDARY:
-- FastAPI connects to Postgres (session pooler on port 5432) as `ai_service`.
-- It is granted ONLY what the AI chat and ingestion pipelines need.
-- It has NO access to:
--   clients, client_invites, projects, project_members, milestones, project_updates,
--   payments, payment_items, meetings, internal_notes, audit_log, staff_roles.
-- If the AI service is compromised, confidential client and financial data remains secure.

-- ------------------------------------------------------------- role definition
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_service') then
    create role ai_service noinherit login;
  end if;
end;
$$;

-- Grant membership to postgres so tests and database administrators can assume the role
grant ai_service to postgres;

-- Schema usage
grant usage on schema public to ai_service;
grant usage on schema extensions to ai_service;
grant usage on all sequences in schema public to ai_service;

-- ---------------------------------------------------------------- table grants
-- 1. SELECT on published/active content
grant select on public.services            to ai_service;
grant select on public.faqs                to ai_service;
grant select on public.portfolio_items     to ai_service;
grant select on public.portfolio_media     to ai_service;
grant select on public.blog_posts          to ai_service;
grant select on public.site_settings       to ai_service;
grant select on public.reviews             to ai_service;
grant select on public.meeting_types       to ai_service;

-- 2. SELECT on estimator tables
grant select on public.estimator_versions      to ai_service;
grant select on public.estimator_service_rates to ai_service;
grant select on public.estimator_factors       to ai_service;
grant select on public.wizard_questions        to ai_service;
grant select on public.wizard_options          to ai_service;
grant select on public.wizard_option_scores    to ai_service;

-- 3. INSERT on leads, estimates, outbox
grant select, insert on public.leads                 to ai_service;
grant select, insert on public.estimates             to ai_service;
grant select, insert on public.notifications_outbox  to ai_service;

-- 4. Full access to chat and proposals
grant select, insert, update, delete on public.chat_sessions     to ai_service;
grant select, insert, update, delete on public.chat_messages     to ai_service;
grant select, insert, update, delete on public.booking_proposals to ai_service;

-- 5. Full access to knowledge base (for background ingestion & reindex worker)
grant select, insert, update, delete on public.knowledge_documents to ai_service;
grant select, insert, update, delete on public.knowledge_chunks    to ai_service;

-- ------------------------------------------------------- RLS policies for ai_service
-- Enable ai_service to query and mutate the tables it is granted access to under RLS.

-- Knowledge base (ingestion & retrieval)
create policy "knowledge_documents: ai_service all"
  on public.knowledge_documents for all to ai_service
  using (true) with check (true);

create policy "knowledge_chunks: ai_service all"
  on public.knowledge_chunks for all to ai_service
  using (true) with check (true);

-- Chat & booking proposals
create policy "chat_sessions: ai_service all"
  on public.chat_sessions for all to ai_service
  using (true) with check (true);

create policy "chat_messages: ai_service all"
  on public.chat_messages for all to ai_service
  using (true) with check (true);

create policy "booking_proposals: ai_service all"
  on public.booking_proposals for all to ai_service
  using (true) with check (true);

-- Leads and estimates (created by the AI agent tools)
create policy "leads: ai_service insert"
  on public.leads for insert to ai_service
  with check (true);

create policy "leads: ai_service read"
  on public.leads for select to ai_service
  using (true);

create policy "estimates: ai_service insert"
  on public.estimates for insert to ai_service
  with check (true);

create policy "estimates: ai_service read"
  on public.estimates for select to ai_service
  using (true);

-- Outbox (alerts triggered by agent handoff)
create policy "notifications_outbox: ai_service insert"
  on public.notifications_outbox for insert to ai_service
  with check (true);

create policy "notifications_outbox: ai_service read"
  on public.notifications_outbox for select to ai_service
  using (true);

-- Estimator & content read access under RLS
create policy "estimator_versions: ai_service read"
  on public.estimator_versions for select to ai_service
  using (true);

create policy "estimator_service_rates: ai_service read"
  on public.estimator_service_rates for select to ai_service
  using (true);

create policy "estimator_factors: ai_service read"
  on public.estimator_factors for select to ai_service
  using (true);

create policy "wizard_questions: ai_service read"
  on public.wizard_questions for select to ai_service
  using (true);

create policy "wizard_options: ai_service read"
  on public.wizard_options for select to ai_service
  using (true);

create policy "wizard_option_scores: ai_service read"
  on public.wizard_option_scores for select to ai_service
  using (true);

create policy "meeting_types: ai_service read"
  on public.meeting_types for select to ai_service
  using (true);

-- ------------------------------------------------ hybrid search function
-- Combines vector similarity (cosine) with full-text keyword matching (simple config)
-- and trigram similarity, merging results with rank weighting (plan section 8.4).
create or replace function public.match_knowledge_chunks(
  query_text         text,
  query_embedding    extensions.vector(1536),
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

grant execute on function public.match_knowledge_chunks(text, extensions.vector(1536), integer, double precision, text)
  to ai_service, authenticated;
