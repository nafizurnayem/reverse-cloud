-- 0012_leads_and_outbox
-- Contact-form and chat leads, and the notifications outbox
-- (plan sections 5.3-E and 5.5).
--
-- Leads are created by server code (the Next.js Route Handler using the
-- service-role key, and later the FastAPI service). Staff can read and manage
-- them. Visitors cannot write to this table directly.
-- Leads are NOT written to the audit log: they hold personal contact details,
-- and the audit log would keep a second copy of them.
--
-- session_id and converted_client_id are plain uuid columns for now. Their
-- foreign keys are added with chat_sessions (Phase 2) and clients (Phase 3).

-- -------------------------------------------------------------------- leads
create table public.leads (
  id                  uuid primary key default gen_random_uuid(),
  source              text not null
                      check (source in ('chat', 'contact_form', 'estimator', 'handoff', 'manual')),
  status              text not null default 'new'
                      check (status in ('new', 'contacted', 'qualified', 'converted', 'lost')),
  name                text not null check (char_length(btrim(name)) between 1 and 200),
  email               extensions.citext,
  phone               text check (char_length(phone) <= 40),
  company             text check (char_length(company) <= 200),
  country             text check (char_length(country) <= 100),
  preferred_locale    text not null default 'en' check (preferred_locale in ('en', 'bn')),
  message             text check (char_length(message) <= 5000),
  service_id          uuid references public.services (id) on delete set null,
  estimate_id         uuid references public.estimates (id) on delete set null,
  session_id          uuid,   -- foreign key added with chat_sessions (Phase 2)
  consent_at          timestamptz,
  utm                 jsonb not null default '{}'::jsonb,
  assigned_to         uuid references auth.users (id) on delete set null,
  converted_client_id uuid,   -- foreign key added with clients (Phase 3)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- At least one way to contact the person.
  constraint leads_needs_contact check (
    nullif(btrim(email::text), '') is not null
    or nullif(btrim(phone), '') is not null
  ),
  constraint leads_email_format check (
    email is null or email::text ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  -- Anyone who came through the chat or the form must have agreed to be contacted.
  constraint leads_consent_required check (
    source not in ('chat', 'contact_form', 'handoff') or consent_at is not null
  )
);

create index leads_status_created_idx on public.leads (status, created_at desc);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function app.set_updated_at();

-- Now that leads exists, estimates can point to it.
alter table public.estimates
  add constraint estimates_lead_id_fkey
  foreign key (lead_id) references public.leads (id) on delete set null;

-- ------------------------------------------------------ notifications_outbox
-- Everything that sends an email or Telegram message writes a row here first.
-- A worker sends it and retries on failure. Server code only.
create table public.notifications_outbox (
  id         uuid primary key default gen_random_uuid(),
  channel    text not null check (channel in ('email', 'telegram')),
  to_address text not null,   -- an email address, or a Telegram chat id
  template   text not null,
  payload    jsonb not null default '{}'::jsonb,
  status     text not null default 'pending'
             check (status in ('pending', 'sent', 'failed')),
  attempts   integer not null default 0 check (attempts >= 0),
  last_error text,
  run_after  timestamptz not null default now(),
  sent_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint outbox_sent_has_time check (status <> 'sent' or sent_at is not null)
);

create index notifications_outbox_status_run_idx
  on public.notifications_outbox (status, run_after);

-- ------------------------------------------------------- Row Level Security
alter table public.leads                enable row level security;
alter table public.notifications_outbox enable row level security;

-- Leads: staff with leads.read can read; leads.manage can change them.
-- Staff may also add a lead by hand, but only as a "manual" lead, so nobody
-- can fake a chat or form lead. There is no delete policy.
create policy "leads: staff read"
  on public.leads for select to authenticated
  using (app.has_permission('leads.read'));

create policy "leads: staff add manual"
  on public.leads for insert to authenticated
  with check (app.has_permission('leads.manage') and source = 'manual');

create policy "leads: staff update"
  on public.leads for update to authenticated
  using      (app.has_permission('leads.manage'))
  with check (app.has_permission('leads.manage'));

-- Outbox: no policies at all. Besides that, take the table's permissions away
-- from the public roles, so even an attempt to read it is refused outright.
revoke all on public.notifications_outbox from anon, authenticated;