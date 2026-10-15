-- 0020_nightly_maintenance
-- Scheduled nightly jobs (plan sections 5.4, 3.8):
--   1. Mark pending payment items past due as 'overdue'.
--   2. Expire unconfirmed booking proposals past their expires_at timestamp.
--   3. Purge expired chat sessions (and cascade messages/proposals) past their 90-day retention.
--   4. Queue payment due reminders to notifications_outbox for active client projects.
--   5. Schedule nightly execution via pg_cron at 02:00 UTC.

-- ------------------------------------------------ mark overdue payment items
create or replace function app.mark_overdue_payment_items()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.payment_items
     set status = 'overdue'
   where status = 'pending'
     and due_on is not null
     and due_on < current_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ------------------------------------------------ expire booking proposals
create or replace function app.expire_booking_proposals()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.booking_proposals
     set status = 'expired'
   where status = 'open'
     and expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ------------------------------------------------ purge expired chat sessions
create or replace function app.purge_expired_chat_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.chat_sessions
   where expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ------------------------------------------------ queue payment due reminders
create or replace function app.queue_payment_due_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select
      pi.id                 as item_id,
      pi.title              as item_title,
      pi.amount_due         as amount_due,
      pi.currency           as currency,
      pi.due_on             as due_on,
      c.id                  as client_id,
      c.full_name           as client_name,
      c.email               as client_email,
      c.preferred_locale    as locale,
      p.id                  as project_id,
      p.title               as project_title
    from public.payment_items pi
    join public.projects p on p.id = pi.project_id
    join public.clients c on c.id = p.client_id
    where pi.status in ('pending', 'overdue')
      and p.status in ('active', 'on_hold')
      and pi.due_on is not null
      and pi.due_on <= (current_date + interval '3 days')::date
      and c.email is not null
      and not exists (
        select 1 from public.notifications_outbox o
        where o.template = 'payment_due_reminder'
          and (o.payload ->> 'payment_item_id')::uuid = pi.id
          and o.created_at >= now() - interval '24 hours'
      )
  loop
    insert into public.notifications_outbox (
      channel,
      to_address,
      template,
      payload
    ) values (
      'email',
      r.client_email,
      'payment_due_reminder',
      jsonb_build_object(
        'payment_item_id', r.item_id,
        'title',           r.item_title,
        'amount_due',      r.amount_due,
        'currency',        r.currency,
        'due_on',          r.due_on,
        'client_id',       r.client_id,
        'client_name',     r.client_name,
        'locale',          r.locale,
        'project_id',      r.project_id,
        'project_title',   r.project_title
      )
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ------------------------------------------------ master maintenance runner
create or replace function app.run_nightly_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_overdue   integer;
  v_proposals integer;
  v_chat      integer;
  v_reminders integer;
begin
  v_overdue   := app.mark_overdue_payment_items();
  v_proposals := app.expire_booking_proposals();
  v_chat      := app.purge_expired_chat_sessions();
  v_reminders := app.queue_payment_due_reminders();

  return jsonb_build_object(
    'marked_overdue',       v_overdue,
    'expired_proposals',    v_proposals,
    'purged_chat_sessions', v_chat,
    'queued_reminders',     v_reminders,
    'ran_at',               now()
  );
end;
$$;

-- ------------------------------------------------ pg_cron schedule registration
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Remove existing job if present
    perform cron.unschedule('nightly-maintenance')
      from cron.job
     where jobname = 'nightly-maintenance';

    -- Run every night at 02:00 UTC
    perform cron.schedule(
      'nightly-maintenance',
      '0 2 * * *',
      'select app.run_nightly_maintenance();'
    );
  end if;
exception
  when others then
    -- Do not fail migration if scheduling raises inside environments with restricted privileges
    null;
end;
$$;
