-- 0026_calcom_webhook_processing
-- Adds the idempotent, atomic processing contract used by Member A's signed
-- Cal.com webhook receiver. Raw webhook payloads contain attendee PII and are
-- deliberately not copied into the delivery ledger or meetings.calcom_payload.

alter table public.meetings
  add column last_calcom_event_at timestamptz;

create table public.calcom_webhook_deliveries (
  id             uuid        primary key default gen_random_uuid(),
  delivery_key   text        not null unique check (delivery_key ~ '^[0-9a-f]{64}$'),
  trigger_event  text        not null check (char_length(trigger_event) between 3 and 80),
  booking_uid    text        not null check (char_length(btrim(booking_uid)) between 1 and 200),
  payload_sha256 text        not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  occurred_at    timestamptz not null,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz not null default now()
);

create index calcom_webhook_deliveries_received_idx
  on public.calcom_webhook_deliveries (received_at desc);
create index calcom_webhook_deliveries_booking_idx
  on public.calcom_webhook_deliveries (booking_uid, occurred_at desc);

alter table public.calcom_webhook_deliveries enable row level security;
revoke all on public.calcom_webhook_deliveries from public, anon, authenticated;

create function public.process_calcom_webhook_delivery(
  p_delivery_key text,
  p_trigger_event text,
  p_occurred_at timestamptz,
  p_booking_uid text,
  p_payload_sha256 text,
  p_event_type_id text,
  p_meeting_type_key text,
  p_proposal_id uuid,
  p_attendee_name text,
  p_attendee_email text,
  p_attendee_timezone text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean := false;
  v_proposal_id uuid;
  v_meeting_type_id uuid;
  v_client_id uuid;
  v_lead_id uuid;
  v_meeting_status text;
  v_proposal_status text;
begin
  insert into public.calcom_webhook_deliveries (
    delivery_key, trigger_event, booking_uid, payload_sha256, occurred_at
  ) values (
    p_delivery_key, p_trigger_event, p_booking_uid, p_payload_sha256, p_occurred_at
  )
  on conflict (delivery_key) do nothing
  returning true into v_inserted;

  if not coalesce(v_inserted, false) then
    return false;
  end if;

  select bp.id, bp.meeting_type_id
    into v_proposal_id, v_meeting_type_id
    from public.booking_proposals bp
   where bp.id = p_proposal_id
   limit 1;

  if v_meeting_type_id is null and nullif(btrim(p_event_type_id), '') is not null then
    select mt.id into v_meeting_type_id
      from public.meeting_types mt
     where mt.calcom_event_type_id = btrim(p_event_type_id)
       and mt.is_active
     limit 1;
  end if;

  if v_meeting_type_id is null and nullif(btrim(p_meeting_type_key), '') is not null then
    select mt.id into v_meeting_type_id
      from public.meeting_types mt
     where mt.key = replace(lower(btrim(p_meeting_type_key)), '-', '_')
       and mt.is_active
     limit 1;
  end if;

  if nullif(btrim(p_attendee_email), '') is not null then
    select c.id into v_client_id
      from public.clients c
     where c.email = lower(btrim(p_attendee_email))::extensions.citext
       and c.archived_at is null
     limit 1;

    select l.id into v_lead_id
      from public.leads l
     where l.email = lower(btrim(p_attendee_email))::extensions.citext
     order by l.created_at desc
     limit 1;
  end if;

  v_meeting_status := case p_trigger_event
    when 'BOOKING_CREATED' then 'confirmed'
    when 'BOOKING_CONFIRMED' then 'confirmed'
    when 'BOOKING_PAID' then 'confirmed'
    when 'BOOKING_RESCHEDULED' then 'rescheduled'
    when 'BOOKING_CANCELLED' then 'cancelled'
    when 'BOOKING_CANCELED' then 'cancelled'
    when 'BOOKING_REJECTED' then 'cancelled'
    when 'BOOKING_NO_SHOW' then 'no_show'
    when 'BOOKING_NO_SHOW_UPDATED' then 'no_show'
    else null
  end;

  if v_meeting_status in ('confirmed', 'rescheduled') then
    if v_meeting_type_id is null then
      raise exception 'meeting_type_not_found' using errcode = 'P0002';
    end if;
    if nullif(btrim(p_attendee_name), '') is null
      or nullif(btrim(p_attendee_email), '') is null
      or p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
      raise exception 'incomplete_booking_event' using errcode = '22023';
    end if;

    insert into public.meetings as existing (
      calcom_booking_uid, meeting_type_id, proposal_id, client_id, lead_id,
      attendee_name, attendee_email, attendee_timezone, starts_at, ends_at,
      status, last_calcom_event_at
    ) values (
      p_booking_uid, v_meeting_type_id, v_proposal_id, v_client_id, v_lead_id,
      btrim(p_attendee_name), lower(btrim(p_attendee_email)), coalesce(nullif(btrim(p_attendee_timezone), ''), 'UTC'),
      p_starts_at, p_ends_at, v_meeting_status, p_occurred_at
    )
    on conflict (calcom_booking_uid) do update
      set meeting_type_id = excluded.meeting_type_id,
          proposal_id = coalesce(excluded.proposal_id, existing.proposal_id),
          client_id = coalesce(excluded.client_id, existing.client_id),
          lead_id = coalesce(excluded.lead_id, existing.lead_id),
          attendee_name = excluded.attendee_name,
          attendee_email = excluded.attendee_email,
          attendee_timezone = excluded.attendee_timezone,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          status = excluded.status,
          last_calcom_event_at = excluded.last_calcom_event_at
    where existing.last_calcom_event_at is null
       or existing.last_calcom_event_at <= excluded.last_calcom_event_at;
  elsif v_meeting_status is not null then
    update public.meetings
       set status = v_meeting_status,
           last_calcom_event_at = p_occurred_at
     where calcom_booking_uid = p_booking_uid
       and (last_calcom_event_at is null or last_calcom_event_at <= p_occurred_at);
  end if;

  v_proposal_status := case
    when p_trigger_event in ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_PAID', 'BOOKING_RESCHEDULED') then 'confirmed'
    when p_trigger_event = 'BOOKING_REJECTED' then 'failed'
    when p_trigger_event in ('BOOKING_CANCELLED', 'BOOKING_CANCELED') then 'cancelled'
    else null
  end;

  if v_proposal_id is not null and v_proposal_status is not null then
    update public.booking_proposals
       set status = v_proposal_status,
           starts_at = case when p_starts_at is not null then p_starts_at else starts_at end,
           ends_at = case when p_ends_at is not null then p_ends_at else ends_at end,
           confirmed_at = case when v_proposal_status = 'confirmed' then coalesce(confirmed_at, p_occurred_at) else confirmed_at end
     where id = v_proposal_id;
  end if;

  return true;
end;
$$;

revoke all on function public.process_calcom_webhook_delivery(
  text, text, timestamptz, text, text, text, text, uuid, text, text, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.process_calcom_webhook_delivery(
  text, text, timestamptz, text, text, text, text, uuid, text, text, text, timestamptz, timestamptz
) to service_role;
