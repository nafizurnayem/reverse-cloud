-- 0012_leads_outbox
-- Contact leads and the reliable email/Telegram notification queue.

create table public.leads (
  id                  uuid primary key default gen_random_uuid(),
  source              text not null default 'contact_form'
                      check (source in ('chat', 'contact_form', 'estimator', 'handoff', 'manual')),
  status              text not null default 'new'
                      check (status in ('new', 'contacted', 'qualified', 'converted', 'lost')),
  name                text not null check (char_length(btrim(name)) between 2 and 120),
  email               extensions.citext,
  phone               text,
  company             text,
  country             text,
  preferred_locale    text not null default 'en' check (preferred_locale in ('en', 'bn')),
  message             text not null default '' check (char_length(message) <= 5000),
  service_id          uuid references public.services (id) on delete set null,
  estimate_id         uuid references public.estimates (id) on delete set null,
  session_id          uuid,
  consent_at          timestamptz,
  utm                 jsonb not null default '{}'::jsonb,
  assigned_to         uuid references auth.users (id) on delete set null,
  converted_client_id uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint leads_contact_method_required check (
    nullif(btrim(email::text), '') is not null
    or nullif(btrim(phone), '') is not null
  ),
  constraint leads_public_consent_required check (
    source not in ('chat', 'contact_form', 'handoff') or consent_at is not null
  ),
  constraint leads_utm_is_object check (jsonb_typeof(utm) = 'object')
);

create index leads_status_created_idx on public.leads (status, created_at desc);
create index leads_service_idx on public.leads (service_id);
create index leads_assigned_idx on public.leads (assigned_to) where assigned_to is not null;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function app.set_updated_at();

alter table public.estimates
  add constraint estimates_lead_id_fkey
  foreign key (lead_id) references public.leads (id) on delete set null;

create table public.notifications_outbox (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null check (channel in ('email', 'telegram')),
  to_address  text not null check (nullif(btrim(to_address), '') is not null),
  template    text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'pending'
              check (status in ('pending', 'sent', 'failed')),
  attempts    integer not null default 0 check (attempts >= 0),
  last_error  text,
  run_after   timestamptz not null default now(),
  locked_at   timestamptz,
  locked_by   text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint notifications_payload_is_object check (jsonb_typeof(payload) = 'object')
);

create index notifications_outbox_ready_idx
  on public.notifications_outbox (status, run_after)
  where status = 'pending';

create trigger notifications_outbox_set_updated_at
  before update on public.notifications_outbox
  for each row execute function app.set_updated_at();

alter table public.leads enable row level security;
alter table public.notifications_outbox enable row level security;

create policy "leads: readers select"
  on public.leads for select to authenticated
  using (app.has_permission('leads.read') or app.has_permission('leads.manage'));

create policy "leads: managers update"
  on public.leads for update to authenticated
  using (app.has_permission('leads.manage'))
  with check (app.has_permission('leads.manage'));

revoke all on public.leads from anon;
revoke insert, delete, truncate, update on public.leads from authenticated;
grant select on public.leads to authenticated;
grant update (status, assigned_to) on public.leads to authenticated;

-- There is deliberately no browser policy for inserting leads or reading the
-- outbox. Public submissions use the narrow function below via server-only
-- service-role code. The Railway worker uses its dedicated database role.
revoke all on public.notifications_outbox from anon, authenticated;

create policy "notifications_outbox: ai worker select"
  on public.notifications_outbox for select to public
  using (current_user = 'ai_service');

create policy "notifications_outbox: ai worker update"
  on public.notifications_outbox for update to public
  using (current_user = 'ai_service')
  with check (current_user = 'ai_service');

create function public.create_contact_lead(
  p_name text,
  p_email text,
  p_phone text,
  p_company text,
  p_country text,
  p_preferred_locale text,
  p_message text,
  p_service_id uuid,
  p_utm jsonb,
  p_staff_email text,
  p_telegram_chat_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_lead_id uuid;
  notification_payload jsonb;
begin
  insert into public.leads (
    source, name, email, phone, company, country, preferred_locale,
    message, service_id, consent_at, utm
  ) values (
    'contact_form', btrim(p_name), nullif(btrim(p_email), ''),
    nullif(btrim(p_phone), ''), nullif(btrim(p_company), ''),
    nullif(btrim(p_country), ''), p_preferred_locale, btrim(p_message),
    p_service_id, now(), coalesce(p_utm, '{}'::jsonb)
  )
  returning id into new_lead_id;

  notification_payload := jsonb_build_object(
    'lead_id', new_lead_id,
    'name', btrim(p_name),
    'email', nullif(btrim(p_email), ''),
    'phone', nullif(btrim(p_phone), ''),
    'company', nullif(btrim(p_company), ''),
    'country', nullif(btrim(p_country), ''),
    'locale', p_preferred_locale,
    'message', btrim(p_message),
    'service_id', p_service_id
  );

  insert into public.notifications_outbox (channel, to_address, template, payload)
  values
    ('email', btrim(p_staff_email), 'new_lead', notification_payload),
    ('telegram', btrim(p_telegram_chat_id), 'new_lead', notification_payload);

  return new_lead_id;
end;
$$;

revoke execute on function public.create_contact_lead(
  text, text, text, text, text, text, text, uuid, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.create_contact_lead(
  text, text, text, text, text, text, text, uuid, jsonb, text, text
) to service_role;

-- Production creates ai_service outside migrations because its password is a
-- deployment secret. Grant the worker its narrow access when that role exists.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'ai_service') then
    grant select, update on public.notifications_outbox to ai_service;
  end if;
end;
$$;


