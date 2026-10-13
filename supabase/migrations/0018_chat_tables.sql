-- 0018_chat_tables
-- Chat sessions, messages, meeting types, and booking proposals (plan sections 5.3-E, 5.3-I, 8.3).
--
-- ARCHITECTURE & PRIVACY:
-- 1. Chat sessions store anonymous visitor or authenticated user conversation state.
-- 2. Sessions default to 90-day retention (expires_at), after which they are purged.
-- 3. Messages cascade-delete with their parent session.
-- 4. Booking proposals are temporary hold states created by the AI agent (default 15-minute expiry).
--    Only a signed-in user confirming the slot turns a proposal into a confirmed meeting.
-- 5. Staff with leads.read can view chat logs and proposals; visitors interact with chat via
--    the server (FastAPI / Route Handler using the dedicated ai_service DB role).

-- ------------------------------------------------------------- meeting_types
-- Catalog of bookable sessions (e.g. Discovery call, Technical consult).
create table public.meeting_types (
  id                   uuid        primary key default gen_random_uuid(),
  key                  text        not null unique check (char_length(btrim(key)) between 2 and 50),
  name_en              text        not null check (char_length(btrim(name_en)) between 2 and 100),
  name_bn              text        check (name_bn is null or char_length(btrim(name_bn)) between 2 and 100),
  description_en       text,
  description_bn       text,
  duration_min         integer     not null check (duration_min > 0 and duration_min <= 480),
  calcom_event_type_id text,
  is_active            boolean     not null default true,
  sort_order           integer     not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index meeting_types_active_idx on public.meeting_types (is_active, sort_order);

create trigger meeting_types_set_updated_at
  before update on public.meeting_types
  for each row execute function app.set_updated_at();

create trigger meeting_types_audit
  after insert or update or delete on public.meeting_types
  for each row execute function app.audit_row_change();

-- Seed the two initial meeting types defined in the plan (section 12)
insert into public.meeting_types (key, name_en, name_bn, duration_min, sort_order)
values
  ('discovery_call',    'Discovery Call',    'ডিসকভারি কল',          30, 1),
  ('technical_consult', 'Technical Consult', 'টেকনিক্যাল কনসাল্টেশন', 45, 2)
on conflict (key) do nothing;

-- ------------------------------------------------------------- chat_sessions
-- Server-tracked conversation sessions.
create table public.chat_sessions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users (id) on delete set null,
  client_id      uuid        references public.clients (id) on delete set null,
  locale         text        not null default 'en' check (locale in ('en', 'bn')),
  page_context   text,
  ip_hash        text,
  status         text        not null default 'active'
                 check (status in ('active', 'closed', 'handoff', 'converted')),
  started_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '90 days'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index chat_sessions_expires_at_idx on public.chat_sessions (expires_at);
create index chat_sessions_status_idx     on public.chat_sessions (status, last_active_at desc);
create index chat_sessions_user_idx       on public.chat_sessions (user_id) where user_id is not null;
create index chat_sessions_client_idx     on public.chat_sessions (client_id) where client_id is not null;

create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function app.set_updated_at();

-- ------------------------------------------------------------- chat_messages
-- Individual messages inside a chat session.
create table public.chat_messages (
  id           uuid        primary key default gen_random_uuid(),
  session_id   uuid        not null references public.chat_sessions (id) on delete cascade,
  role         text        not null check (role in ('user', 'assistant', 'tool', 'system')),
  content      text        not null,
  tool_name    text,
  tool_payload jsonb,
  model        text,
  tokens_in    integer     check (tokens_in is null or tokens_in >= 0),
  tokens_out   integer     check (tokens_out is null or tokens_out >= 0),
  request_id   text,
  created_at   timestamptz not null default now()
);

create index chat_messages_session_idx    on public.chat_messages (session_id, created_at);
create index chat_messages_created_at_idx on public.chat_messages (created_at desc);

-- --------------------------------------------------------- booking_proposals
-- Short-lived appointment slot proposals proposed by the AI agent.
create table public.booking_proposals (
  id              uuid        primary key default gen_random_uuid(),
  session_id      uuid        not null references public.chat_sessions (id) on delete cascade,
  meeting_type_id uuid        not null references public.meeting_types (id) on delete restrict,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null check (ends_at > starts_at),
  timezone        text        not null check (char_length(btrim(timezone)) > 0),
  intake_summary  text,
  status          text        not null default 'open'
                  check (status in ('open', 'confirmed', 'expired', 'failed', 'cancelled')),
  expires_at      timestamptz not null default (now() + interval '15 minutes'),
  confirmed_by    uuid        references auth.users (id) on delete set null,
  confirmed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index booking_proposals_session_idx on public.booking_proposals (session_id, created_at desc);
create index booking_proposals_status_idx  on public.booking_proposals (status, expires_at);

create trigger booking_proposals_set_updated_at
  before update on public.booking_proposals
  for each row execute function app.set_updated_at();

-- ------------------------------------------------------- Row Level Security
alter table public.meeting_types      enable row level security;
alter table public.chat_sessions      enable row level security;
alter table public.chat_messages      enable row level security;
alter table public.booking_proposals  enable row level security;

-- meeting_types: anyone (visitors and clients) can read active types
create policy "meeting_types: public read active"
  on public.meeting_types for select to anon, authenticated
  using (is_active = true);

-- meeting_types: staff with content.manage can view all and manage
create policy "meeting_types: staff manage"
  on public.meeting_types for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

-- chat_sessions: staff with leads.read can view chat logs
create policy "chat_sessions: staff read"
  on public.chat_sessions for select to authenticated
  using (app.has_permission('leads.read'));

-- chat_sessions: staff with leads.manage can update/delete
create policy "chat_sessions: staff manage"
  on public.chat_sessions for all to authenticated
  using      (app.has_permission('leads.manage'))
  with check (app.has_permission('leads.manage'));

-- chat_messages: staff with leads.read can view messages
create policy "chat_messages: staff read"
  on public.chat_messages for select to authenticated
  using (app.has_permission('leads.read'));

-- chat_messages: staff with leads.manage can manage
create policy "chat_messages: staff manage"
  on public.chat_messages for all to authenticated
  using      (app.has_permission('leads.manage'))
  with check (app.has_permission('leads.manage'));

-- booking_proposals: staff with leads.read can view proposals
create policy "booking_proposals: staff read"
  on public.booking_proposals for select to authenticated
  using (app.has_permission('leads.read'));

-- booking_proposals: staff with leads.manage can manage
create policy "booking_proposals: staff manage"
  on public.booking_proposals for all to authenticated
  using      (app.has_permission('leads.manage'))
  with check (app.has_permission('leads.manage'));

-- -------------------------------------------------------- table-level grants
revoke all on public.meeting_types     from anon, authenticated;
revoke all on public.chat_sessions     from anon, authenticated;
revoke all on public.chat_messages     from anon, authenticated;
revoke all on public.booking_proposals from anon, authenticated;

grant select on public.meeting_types to anon, authenticated;
grant insert, update, delete on public.meeting_types to authenticated;

grant select on public.chat_sessions to authenticated;
grant insert, update, delete on public.chat_sessions to authenticated;

grant select on public.chat_messages to authenticated;
grant insert, update, delete on public.chat_messages to authenticated;

grant select on public.booking_proposals to authenticated;
grant insert, update, delete on public.booking_proposals to authenticated;
