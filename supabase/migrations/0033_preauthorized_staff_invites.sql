-- 0033_preauthorized_staff_invites.sql
-- Pre-authorized staff allowlist: allows admins to assign roles to emails before the person signs in.
-- When the person logs in via OAuth or Magic Link, their pre-authorized roles are automatically activated.

-- 1. Create table for staff pre-authorizations
create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  role_id uuid not null references public.roles(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  constraint staff_invites_email_format check (email::text ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create unique index if not exists staff_invites_pending_unique
  on public.staff_invites (email, role_id)
  where accepted_at is null;

alter table public.staff_invites enable row level security;

create policy "staff_invites: staff manage"
  on public.staff_invites
  for all
  to authenticated
  using (app.has_permission('staff.manage'))
  with check (app.has_permission('staff.manage'));

revoke all on public.staff_invites from public, anon;
grant select, insert, update, delete on public.staff_invites to authenticated;

-- 2. Preauthorize a staff member
create or replace function public.preauthorize_staff_member(
  p_email text,
  p_role_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clean_email text := lower(btrim(coalesce(p_email, '')));
  v_role public.roles;
  v_existing_user_id uuid;
  v_invite_id uuid;
begin
  if (select auth.uid()) is null or not app.has_permission('staff.manage') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if v_clean_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  select * into v_role from public.roles where id = p_role_id;
  if not found then
    raise exception 'role_not_found' using errcode = '22023';
  end if;

  -- If user already exists in auth.users, assign directly
  select id into v_existing_user_id
    from auth.users
   where lower(email::text) = v_clean_email
   limit 1;

  if v_existing_user_id is not null then
    perform public.set_staff_role_status(v_existing_user_id, p_role_id, true);
    return jsonb_build_object('status', 'assigned', 'user_id', v_existing_user_id);
  end if;

  -- User does not exist yet: insert into staff_invites allowlist
  insert into public.staff_invites (email, role_id, invited_by)
  values (v_clean_email::extensions.citext, p_role_id, (select auth.uid()))
  on conflict (email, role_id) where accepted_at is null
  do update set created_at = now(), invited_by = excluded.invited_by
  returning id into v_invite_id;

  return jsonb_build_object('status', 'preauthorized', 'invite_id', v_invite_id);
end;
$$;

revoke all on function public.preauthorize_staff_member(text, uuid) from public, anon;
grant execute on function public.preauthorize_staff_member(text, uuid) to authenticated;

-- 3. Revoke a pending invite
create or replace function public.revoke_staff_invite(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not app.has_permission('staff.manage') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  delete from public.staff_invites
   where id = p_invite_id
     and accepted_at is null;

  return found;
end;
$$;

revoke all on function public.revoke_staff_invite(uuid) from public, anon;
grant execute on function public.revoke_staff_invite(uuid) to authenticated;

-- 4. List pending staff invites
create or replace function public.list_pending_staff_invites()
returns table (
  invite_id uuid,
  email text,
  role_id uuid,
  role_name text,
  role_key text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not app.has_permission('staff.manage') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  return query
  select si.id,
         si.email::text,
         r.id,
         r.name,
         r.key,
         si.created_at
    from public.staff_invites si
    join public.roles r on r.id = si.role_id
   where si.accepted_at is null
   order by si.created_at desc;
end;
$$;

revoke all on function public.list_pending_staff_invites() from public, anon;
grant execute on function public.list_pending_staff_invites() to authenticated;

-- 5. Auto-claim trigger when a new user signs up
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  -- Auto-activate pre-authorized staff roles for this email
  if new.email is not null then
    insert into public.staff_roles (user_id, role_id, is_active)
    select new.id, si.role_id, true
      from public.staff_invites si
     where lower(si.email::text) = lower(new.email::text)
       and si.accepted_at is null
    on conflict (user_id, role_id)
    do update set is_active = true;

    update public.staff_invites
       set accepted_at = now(),
           accepted_by = new.id
     where lower(email::text) = lower(new.email::text)
       and accepted_at is null;
  end if;

  return new;
end;
$$;

-- 6. Claim pending staff invites on login (for existing users or callback)
create or replace function public.claim_my_staff_invites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_count integer := 0;
begin
  if v_uid is null then
    return 0;
  end if;

  select lower(u.email::text) into v_email
    from auth.users u where u.id = v_uid;

  if v_email is null then
    return 0;
  end if;

  with inserted as (
    insert into public.staff_roles (user_id, role_id, is_active)
    select v_uid, si.role_id, true
      from public.staff_invites si
     where lower(si.email::text) = v_email
       and si.accepted_at is null
    on conflict (user_id, role_id)
    do update set is_active = true
    returning 1
  ),
  updated as (
    update public.staff_invites
       set accepted_at = now(),
           accepted_by = v_uid
     where lower(email::text) = v_email
       and accepted_at is null
    returning 1
  )
  select count(*)::integer into v_count from inserted;

  return v_count;
end;
$$;

revoke all on function public.claim_my_staff_invites() from public, anon;
grant execute on function public.claim_my_staff_invites() to authenticated;
