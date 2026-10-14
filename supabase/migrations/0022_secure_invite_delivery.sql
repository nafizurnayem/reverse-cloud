-- 0022_secure_invite_delivery
-- Enables secure invitation email delivery via public.notifications_outbox when
-- p_send_email is true in public.create_client_invite (plan sections 5.3-B, 9.2).

create or replace function public.create_client_invite(
  p_client_id  uuid,
  p_email      text,
  p_send_email boolean default false
)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_client     public.clients;
  v_email      extensions.citext;
  v_token      text;
  v_invite_id  uuid;
  v_expires_at timestamptz;
begin
  if (select auth.uid()) is null or not app.has_permission('clients.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  v_email := nullif(btrim(p_email), '');
  if v_email is null or v_email::text !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_invite_email' using errcode = '22023';
  end if;

  select * into v_client from public.clients where id = p_client_id for update;
  if not found or v_client.archived_at is not null then
    raise exception 'client_not_found' using errcode = 'P0002';
  end if;
  if v_client.user_id is not null then
    raise exception 'client_already_linked' using errcode = '55000';
  end if;

  -- A new invite replaces any older open one.
  update public.client_invites
     set revoked_at = now()
   where client_id = p_client_id
     and accepted_at is null
     and revoked_at is null;

  -- 32 random bytes as URL-safe base64 (43 characters, no padding).
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_expires_at := now() + interval '14 days';

  insert into public.client_invites (client_id, email, token_hash, expires_at, created_by)
  values (
    p_client_id,
    v_email,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_expires_at,
    (select auth.uid())
  )
  returning id into v_invite_id;

  -- Queue email delivery to the outbox when explicitly requested.
  if coalesce(p_send_email, false) then
    insert into public.notifications_outbox (
      channel,
      to_address,
      template,
      payload
    ) values (
      'email',
      v_email::text,
      'client_invite',
      jsonb_build_object(
        'invite_id', v_invite_id,
        'client_id', p_client_id,
        'client_name', v_client.full_name,
        'token', v_token,
        'expires_at', v_expires_at,
        'locale', coalesce(v_client.preferred_locale, 'en')
      )
    );
  end if;

  return query select v_invite_id, v_token, v_expires_at;
end;
$$;

revoke all on function public.create_client_invite(uuid, text, boolean) from public, anon;
grant execute on function public.create_client_invite(uuid, text, boolean) to authenticated;
