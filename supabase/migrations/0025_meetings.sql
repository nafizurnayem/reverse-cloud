-- 0025_meetings
-- Confirmed meetings created when a booking proposal is accepted via Cal.com
-- webhook (plan sections 4.1, 5.3-E, 5.3-I).
--
-- DATA MODEL:
--   booking_proposals (0018) → meetings (this migration)
--
-- A meeting row is created by the Cal.com webhook handler once a booking is
-- BOOKING_CONFIRMED. The proposal_id links back to the proposal so the AI
-- conversation context is preserved.
--
-- SECURITY:
--   - Staff with meetings.read can see all meetings.
--   - Clients can only see their own meetings (via lead or client link).
--   - No direct insert/update allowed from the web client; writes happen only
--     through the service-role webhook handler.

-- --------------------------------------------------------------- meetings
create table public.meetings (
  id               uuid        primary key default gen_random_uuid(),
  -- Cal.com booking reference (uid from the webhook payload)
  calcom_booking_uid  text     unique not null check (char_length(btrim(calcom_booking_uid)) > 0),
  meeting_type_id  uuid        not null references public.meeting_types (id) on delete restrict,
  proposal_id      uuid        references public.booking_proposals (id) on delete set null,
  -- Optional links to known parties (set when visitor is a logged-in client or known lead)
  client_id        uuid        references public.clients (id) on delete set null,
  lead_id          uuid        references public.leads (id) on delete set null,
  -- Attendee info from Cal.com (stored for display even if not linked to a client)
  attendee_name    text        not null check (char_length(btrim(attendee_name)) between 1 and 200),
  attendee_email   text        not null check (attendee_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  attendee_timezone text       not null check (char_length(btrim(attendee_timezone)) > 0),
  -- Scheduled time window
  starts_at        timestamptz not null,
  ends_at          timestamptz not null check (ends_at > starts_at),
  -- Meeting status driven by Cal.com webhooks
  status           text        not null default 'confirmed'
                   check (status in ('confirmed', 'rescheduled', 'cancelled', 'no_show')),
  -- Rich data from Cal.com stored verbatim for audit/debugging
  calcom_payload   jsonb,
  -- Internal notes visible only to staff
  staff_notes      text        check (char_length(staff_notes) <= 5000),
  -- Who handled this on our side (assigned after booking)
  assigned_to      uuid        references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index meetings_client_idx    on public.meetings (client_id) where client_id is not null;
create index meetings_lead_idx      on public.meetings (lead_id)   where lead_id is not null;
create index meetings_starts_at_idx on public.meetings (starts_at desc);
create index meetings_status_idx    on public.meetings (status, starts_at);

create trigger meetings_set_updated_at
  before update on public.meetings
  for each row execute function app.set_updated_at();

create trigger meetings_audit
  after insert or update or delete on public.meetings
  for each row execute function app.audit_row_change();

-- ------------------------------------------------------- Row Level Security
alter table public.meetings enable row level security;

-- Staff with meetings.read can read all meetings
create policy "meetings: staff read"
  on public.meetings for select to authenticated
  using (app.has_permission('meetings.read'));

-- Staff with leads.manage can update (assign, add notes, mark no-show)
create policy "meetings: staff update"
  on public.meetings for update to authenticated
  using      (app.has_permission('leads.manage'))
  with check (app.has_permission('leads.manage'));

-- Clients can see their own confirmed / rescheduled meetings
create policy "meetings: client read own"
  on public.meetings for select to authenticated
  using (
    app.my_client_id() is not null
    and client_id = app.my_client_id()
    and status in ('confirmed', 'rescheduled')
  );

-- ------------------------------------------------------ table-level grants
-- Insert is handled exclusively by service_role (webhook handler) — no
-- direct client/authenticated insert is allowed from the browser.
revoke all on public.meetings from anon, authenticated;
grant select                on public.meetings to authenticated;
grant update (staff_notes, assigned_to, status) on public.meetings to authenticated;
