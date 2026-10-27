-- 0029_maintenance_invite_and_fk_fixes.sql
-- Fixes for:
--   FX-12: Robust nightly maintenance runner & payment reminder text comparison
--   FX-18: Secure accept_client_invite validation for already-linked users
--   FX-19: Pin search_path on app.guard_client_self_update
--   FX-27: Make circular foreign keys between leads and estimates deferrable initially deferred

-- -----------------------------------------------------------------------------
-- FX-12: queue_payment_due_reminders: compare payload->>'payment_item_id' as text
-- -----------------------------------------------------------------------------
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
          and (o.payload ->> 'payment_item_id') = pi.id::text
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

-- -----------------------------------------------------------------------------
-- FX-12: run_nightly_maintenance: isolate each task in its own sub-transaction
-- -----------------------------------------------------------------------------
create or replace function app.run_nightly_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_overdue        integer := 0;
  v_proposals      integer := 0;
  v_chat           integer := 0;
  v_reminders      integer := 0;
  v_overdue_err    text;
  v_proposals_err  text;
  v_chat_err       text;
  v_reminders_err  text;
begin
  begin
    v_overdue := app.mark_overdue_payment_items();
  exception when others then
    v_overdue_err := sqlerrm;
  end;

  begin
    v_proposals := app.expire_booking_proposals();
  exception when others then
    v_proposals_err := sqlerrm;
  end;

  begin
    v_chat := app.purge_expired_chat_sessions();
  exception when others then
    v_chat_err := sqlerrm;
  end;

  begin
    v_reminders := app.queue_payment_due_reminders();
  exception when others then
    v_reminders_err := sqlerrm;
  end;

  return jsonb_build_object(
    'marked_overdue',       v_overdue,
    'expired_proposals',    v_proposals,
    'purged_chat_sessions', v_chat,
    'queued_reminders',     v_reminders,
    'overdue_error',        v_overdue_err,
    'proposals_error',      v_proposals_err,
    'chat_error',           v_chat_err,
    'reminders_error',      v_reminders_err,
    'ran_at',               now()
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- FX-18: accept_client_invite: strictly validate token for already-linked users
-- -----------------------------------------------------------------------------
create or replace function public.accept_client_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_auth_email text;
  v_confirmed  timestamptz;
  v_invite     public.client_invites;
  v_client     public.clients;
  v_matches    boolean;
begin
  if v_uid is null then
    raise exception 'invalid_or_expired_invite';
  end if;

  select u.email, u.email_confirmed_at into v_auth_email, v_confirmed
    from auth.users u where u.id = v_uid;

  select * into v_invite
    from public.client_invites ci
   where ci.token_hash = encode(extensions.digest(btrim(coalesce(p_token, '')), 'sha256'), 'hex')
   for update;
  if not found then
    raise exception 'invalid_or_expired_invite';
  end if;

  select * into v_client from public.clients c where c.id = v_invite.client_id for update;
  if not found then
    raise exception 'invalid_or_expired_invite';
  end if;

  v_matches := v_confirmed is not null
           and nullif(btrim(v_auth_email), '') is not null
           and v_invite.email = btrim(v_auth_email)::extensions.citext;

  -- If already linked to this same person: only succeed if the invite is valid, unexpired, unrevoked and matches email
  if v_client.user_id = v_uid then
    if v_invite.accepted_at is null
       and v_invite.revoked_at is null
       and v_invite.expires_at > now()
       and v_matches then
      update public.client_invites
         set accepted_at = now(), accepted_by = v_uid
       where id = v_invite.id;
      return v_client.id;
    else
      raise exception 'invalid_or_expired_invite';
    end if;
  end if;

  if v_invite.accepted_at is not null
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
     or not v_matches
     or v_client.archived_at is not null
     or v_client.user_id is not null
     or exists (select 1 from public.clients c where c.user_id = v_uid) then
    raise exception 'invalid_or_expired_invite';
  end if;

  update public.clients set user_id = v_uid where id = v_client.id;
  update public.client_invites
     set accepted_at = now(), accepted_by = v_uid
   where id = v_invite.id;

  return v_client.id;
end;
$$;

revoke execute on function public.accept_client_invite(text) from public, anon;
grant execute on function public.accept_client_invite(text) to authenticated;

-- -----------------------------------------------------------------------------
-- FX-19: guard_client_self_update: add security definer and set search_path = ''
-- -----------------------------------------------------------------------------
create or replace function app.guard_client_self_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and not app.has_permission('clients.manage')
     and (   new.email       is distinct from old.email
          or new.country     is distinct from old.country
          or new.stage       is distinct from old.stage
          or new.source      is distinct from old.source
          or new.source_ref  is distinct from old.source_ref
          or new.archived_at is distinct from old.archived_at
          or new.created_by  is distinct from old.created_by
          or new.user_id     is distinct from old.user_id)
  then
    raise exception 'clients: only staff can change these fields'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- FX-27: circular FKs between leads and estimates: deferrable initially deferred
-- -----------------------------------------------------------------------------
alter table public.leads
  drop constraint if exists leads_estimate_id_fkey,
  add constraint leads_estimate_id_fkey
    foreign key (estimate_id) references public.estimates (id) on delete set null
    deferrable initially deferred;

alter table public.estimates
  drop constraint if exists estimates_lead_id_fkey,
  add constraint estimates_lead_id_fkey
    foreign key (lead_id) references public.leads (id) on delete set null
    deferrable initially deferred;
