-- 0031_booking_proposals_and_chat_lead.sql
-- Fixes for:
--   FX-06: Atomic, secure confirm_booking_proposal RPC
--   FX-13: create_chat_lead RPC with dual notifications for ai_service + least privilege

-- -----------------------------------------------------------------------------
-- FX-06: confirm_booking_proposal: atomic claim and retrieval of proposal data
-- -----------------------------------------------------------------------------
create or replace function public.confirm_booking_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_client_id uuid := app.my_client_id();
  v_proposal record;
  v_session record;
  v_updated record;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_proposal_id is null then
    raise exception 'invalid_proposal_id' using errcode = '22023';
  end if;

  -- Read proposal and its associated chat session
  select bp.*, mt.key as meeting_type_key, mt.calcom_event_type_id, mt.name_en as meeting_name
    into v_proposal
    from public.booking_proposals bp
    join public.meeting_types mt on mt.id = bp.meeting_type_id
   where bp.id = p_proposal_id;

  if not found then
    raise exception 'proposal_not_found' using errcode = 'P0002';
  end if;

  select * into v_session
    from public.chat_sessions
   where id = v_proposal.session_id;

  -- Caller must own the session or client; if anonymous session, claim is allowed
  if v_session.user_id is not null and v_session.user_id != v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_session.client_id is not null and v_client_id is not null and v_session.client_id != v_client_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Proposal must be open
  if v_proposal.status != 'open' then
    raise exception 'proposal_not_open' using errcode = '22023';
  end if;

  -- Proposal must not be expired
  if v_proposal.expires_at <= now() then
    update public.booking_proposals
       set status = 'expired', updated_at = now()
     where id = p_proposal_id;
    raise exception 'proposal_expired' using errcode = '22023';
  end if;

  -- Atomically claim the slot
  update public.booking_proposals
     set status = 'confirmed',
         confirmed_by = v_uid,
         confirmed_at = now(),
         updated_at = now()
   where id = p_proposal_id
     and status = 'open'
     and expires_at > now()
  returning * into v_updated;

  if v_updated.id is null then
    raise exception 'proposal_already_confirmed_or_expired' using errcode = '22023';
  end if;

  -- Bind user / client to session if previously anonymous
  update public.chat_sessions
     set user_id = coalesce(user_id, v_uid),
         client_id = coalesce(client_id, v_client_id),
         updated_at = now()
   where id = v_proposal.session_id
     and (user_id is null or client_id is null);

  return jsonb_build_object(
    'proposal_id',           v_updated.id,
    'status',                v_updated.status,
    'starts_at',             v_updated.starts_at,
    'ends_at',               v_updated.ends_at,
    'timezone',              v_updated.timezone,
    'intake_summary',        v_updated.intake_summary,
    'meeting_type_id',       v_updated.meeting_type_id,
    'meeting_type_key',      v_proposal.meeting_type_key,
    'meeting_name',          v_proposal.meeting_name,
    'calcom_event_type_id',  v_proposal.calcom_event_type_id,
    'confirmed_by',          v_updated.confirmed_by,
    'confirmed_at',          v_updated.confirmed_at
  );
end;
$$;

revoke all on function public.confirm_booking_proposal(uuid) from public, anon;
grant execute on function public.confirm_booking_proposal(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- FX-13: create_chat_lead: secure lead insertion + dual outbox queue for ai_service
-- -----------------------------------------------------------------------------
create or replace function public.create_chat_lead(
  p_name text,
  p_email text default null,
  p_phone text default null,
  p_company text default null,
  p_country text default null,
  p_preferred_locale text default 'en',
  p_message text default '',
  p_service_id uuid default null,
  p_utm jsonb default '{}'::jsonb,
  p_staff_email text default 'admin@reversecloud.io',
  p_telegram_chat_id text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_lead_id uuid;
  notification_payload jsonb;
  v_staff_email text := nullif(btrim(coalesce(p_staff_email, '')), '');
  v_telegram_id text := nullif(btrim(coalesce(p_telegram_chat_id, '')), '');
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null or char_length(btrim(p_name)) < 2 then
    raise exception 'invalid_lead_name' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_email, '')), '') is null and nullif(btrim(coalesce(p_phone, '')), '') is null then
    raise exception 'contact_method_required' using errcode = '22023';
  end if;

  insert into public.leads (
    source, name, email, phone, company, country, preferred_locale,
    message, service_id, consent_at, utm
  ) values (
    'chat', btrim(p_name), nullif(btrim(p_email), ''),
    nullif(btrim(p_phone), ''), nullif(btrim(p_company), ''),
    nullif(btrim(p_country), ''), coalesce(p_preferred_locale, 'en'), coalesce(btrim(p_message), ''),
    p_service_id, now(), coalesce(p_utm, '{}'::jsonb)
  )
  returning id into new_lead_id;

  notification_payload := jsonb_build_object(
    'lead_id', new_lead_id,
    'source', 'chat',
    'name', btrim(p_name),
    'email', nullif(btrim(p_email), ''),
    'phone', nullif(btrim(p_phone), ''),
    'company', nullif(btrim(p_company), ''),
    'country', nullif(btrim(p_country), ''),
    'locale', coalesce(p_preferred_locale, 'en'),
    'message', coalesce(btrim(p_message), ''),
    'service_id', p_service_id
  );

  insert into public.notifications_outbox (channel, to_address, template, payload)
  values
    ('email', coalesce(v_staff_email, 'admin@reversecloud.io'), 'new_lead', notification_payload),
    ('telegram', coalesce(v_telegram_id, 'alerts'), 'new_lead', notification_payload);

  return new_lead_id;
end;
$$;

revoke all on function public.create_chat_lead(
  text, text, text, text, text, text, text, uuid, jsonb, text, text
) from public, anon, authenticated;

grant execute on function public.create_chat_lead(
  text, text, text, text, text, text, text, uuid, jsonb, text, text
) to ai_service, service_role;

-- ai_service should create leads via the RPC and not read table leads directly
revoke select on public.leads from ai_service;
