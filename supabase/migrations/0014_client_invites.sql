-- 0014_client_invites
-- Invitations that link a signed-in account to a client record, and the
-- functions the web app calls (plan sections 5.3-B and 9.2).
--
-- Only a SHA-256 hash of each invite token is stored. The raw token is returned
-- once by create_client_invite and never kept. Invites expire after 14 days and
-- work once. There is no email delivery yet (see create_client_invite).

-- ------------------------------------------------------------ client_invites
create table public.client_invites (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  email       extensions.citext not null,
  token_hash  text not null unique check (char_length(token_hash) = 64),
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at  timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint client_invites_email_format check (
    email::text ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint client_invites_expiry_after_creation check (expires_at > created_at),
  constraint client_invites_closed_once check (
    accepted_at is null or revoked_at is null
  )
);

create index client_invites_client_idx on public.client_invites (client_id);

-- At most one open (not accepted, not revoked) invite per client.
create unique index client_invites_one_open_per_client
  on public.client_invites (client_id)
  where accepted_at is null and revoked_at is null;

-- ------------------------------------------------------- Row Level Security
alter table public.client_invites enable row level security;

create policy "client_invites: staff read"
  on public.client_invites for select to authenticated
  using (app.has_permission('clients.manage'));

-- Writes happen only through the functions below. token_hash is not readable
-- by anyone through the API.
revoke all on public.client_invites from anon, authenticated;
grant select (id, client_id, email, expires_at, accepted_at, accepted_by,
              revoked_at, created_by, created_at)
  on public.client_invites to authenticated;

-- --------------------------------------------------------- create an invite
-- Staff only (clients.manage). Returns the raw token ONCE; only its hash is stored.
-- p_email is the address the person must sign in with to accept.
-- p_send_email must stay false until a secure delivery method exists: the
-- outbox keeps its payload, which would store the raw token.
create function public.create_client_invite(
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

  if coalesce(p_send_email, false) then
    raise exception 'email_delivery_not_enabled' using errcode = '0A000';
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

  return query select v_invite_id, v_token, v_expires_at;
end;
$$;

-- --------------------------------------------------------- accept an invite
-- Called by the signed-in person. Their own CONFIRMED email (from auth.users,
-- never a parameter) must match the invite email. Calling it again for a client
-- already linked to the same person just returns that client.
-- Every other failure raises the same message, so tokens cannot be probed.
create function public.accept_client_invite(p_token text)
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

  -- Already linked to this same person: nothing left to do.
  if v_client.user_id = v_uid then
    if v_invite.accepted_at is null and v_invite.revoked_at is null
       and v_invite.expires_at > now() and v_matches then
      update public.client_invites
         set accepted_at = now(), accepted_by = v_uid
       where id = v_invite.id;
    end if;
    return v_client.id;
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

-- --------------------------------------------- link the signed-in account
-- For the sign-in callback. Takes no parameters. In order: return the client
-- already linked to this account; else link the unlinked client whose email
-- matches this account's confirmed email; else create a prospect.
create function public.link_my_client_account()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_auth_email text;
  v_confirmed  timestamptz;
  v_meta       jsonb;
  v_email      extensions.citext;
  v_client     public.clients;
  v_client_id  uuid;
  v_name       text;
begin
  if v_uid is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select c.id into v_client_id from public.clients c where c.user_id = v_uid;
  if found then
    return v_client_id;
  end if;

  select u.email, u.email_confirmed_at, u.raw_user_meta_data
    into v_auth_email, v_confirmed, v_meta
    from auth.users u where u.id = v_uid;
  if not found or v_confirmed is null or nullif(btrim(v_auth_email), '') is null then
    raise exception 'email_not_confirmed';
  end if;
  v_email := btrim(v_auth_email);

  select * into v_client from public.clients c where c.email = v_email for update;
  if found then
    if v_client.user_id = v_uid then
      return v_client.id;
    end if;
    if v_client.user_id is not null or v_client.archived_at is not null then
      raise exception 'email_already_linked';
    end if;
    update public.clients set user_id = v_uid where id = v_client.id;
    return v_client.id;
  end if;

  v_name := left(coalesce(
    nullif(btrim(v_meta ->> 'full_name'), ''),
    nullif(btrim(v_meta ->> 'name'), ''),
    split_part(btrim(v_auth_email), '@', 1)
  ), 200);

  begin
    insert into public.clients (user_id, full_name, email, stage, source, created_by)
    values (v_uid, v_name, v_email, 'prospect', 'website', null)
    returning id into v_client_id;
  exception when unique_violation then
    -- A parallel call for the same account got there first.
    select c.id into v_client_id from public.clients c where c.user_id = v_uid;
    if v_client_id is null then
      raise exception 'email_already_linked';
    end if;
  end;

  return v_client_id;
end;
$$;

-- ---------------------------------------------------------- revoke an invite
-- Staff only. true = the invite was open and is now closed;
-- false = it did not exist or was already accepted or revoked.
create function public.revoke_client_invite(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not app.has_permission('clients.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.client_invites
     set revoked_at = now()
   where id = p_invite_id
     and accepted_at is null
     and revoked_at is null;

  return found;
end;
$$;

-- --------------------------------------------------------------- permissions
-- Only signed-in users may call these. Each one checks who the caller is.
revoke execute on function public.create_client_invite(uuid, text, boolean) from public, anon;
revoke execute on function public.accept_client_invite(text)                from public, anon;
revoke execute on function public.link_my_client_account()                  from public, anon;
revoke execute on function public.revoke_client_invite(uuid)                from public, anon;

grant execute on function public.create_client_invite(uuid, text, boolean) to authenticated;
grant execute on function public.accept_client_invite(text)                to authenticated;
grant execute on function public.link_my_client_account()                  to authenticated;
grant execute on function public.revoke_client_invite(uuid)                to authenticated;
