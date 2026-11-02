-- Staff roles reference auth.users, so a missing optional profile must not block assignment.
create or replace function public.set_staff_role_status(
  p_user_id uuid,
  p_role_id uuid,
  p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_key text;
  v_assignment_active boolean;
  v_active_admins integer;
begin
  if (select auth.uid()) is null or not app.has_permission('staff.manage') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if p_user_id is null or p_role_id is null or p_is_active is null then
    raise exception 'invalid_staff_role' using errcode = '22023';
  end if;

  lock table public.staff_roles in share row exclusive mode;

  select r.key into v_role_key
    from public.roles r
   where r.id = p_role_id;

  if not found or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'invalid_staff_role' using errcode = '22023';
  end if;

  select sr.is_active into v_assignment_active
    from public.staff_roles sr
   where sr.user_id = p_user_id
     and sr.role_id = p_role_id;

  if not p_is_active and coalesce(v_assignment_active, false) and v_role_key = 'admin' then
    select count(*)::integer into v_active_admins
      from public.staff_roles sr
      join public.roles r on r.id = sr.role_id
     where r.key = 'admin'
       and sr.is_active;

    if v_active_admins <= 1 then
      raise exception 'last_active_admin' using errcode = 'P0001';
    end if;
  end if;

  if p_is_active then
    insert into public.staff_roles (user_id, role_id, is_active)
    values (p_user_id, p_role_id, true)
    on conflict (user_id, role_id) do update
      set is_active = excluded.is_active;
  else
    if v_assignment_active is null then
      raise exception 'staff_role_not_found' using errcode = 'P0002';
    end if;

    update public.staff_roles
       set is_active = false
     where user_id = p_user_id
       and role_id = p_role_id;
  end if;

  return true;
end;
$$;

revoke all on function public.set_staff_role_status(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_staff_role_status(uuid, uuid, boolean) to authenticated;
