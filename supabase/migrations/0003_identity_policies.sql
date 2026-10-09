-- 0003_identity_policies
-- Helper functions + access rules for the identity tables (plan sections 5.4 and 5.5).

-- ------------------------------------------------------------ helper functions
-- SECURITY DEFINER = the function reads the tables as its owner, so it is not
-- blocked by RLS itself. That avoids an endless loop when a policy on
-- staff_roles needs to look inside staff_roles.
-- "(select auth.uid())" is written this way on purpose: Postgres evaluates it
-- once per query instead of once per row.

create function app.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_roles
    where user_id = (select auth.uid())
      and is_active
  );
$$;

create function app.has_permission(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_roles sr
    join public.role_permissions rp on rp.role_id = sr.role_id
    where sr.user_id = (select auth.uid())
      and sr.is_active
      and rp.permission_key = p
  );
$$;

-- Only signed-in users may call these. Visitors (anon) may not.
revoke execute on function app.is_staff()           from public, anon;
revoke execute on function app.has_permission(text) from public, anon;
grant  usage   on schema   app                      to authenticated;
grant  execute on function app.is_staff()           to authenticated;
grant  execute on function app.has_permission(text) to authenticated;

-- ------------------------------------------------------------------- profiles
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: staff read all"
  on public.profiles for select to authenticated
  using (app.is_staff());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- No insert policy: profiles are created only by the signup trigger.

-- ---------------------------------------------------------------- permissions
-- The list of permissions is fixed by migrations. Staff can read it, nobody
-- can change it through the API.
create policy "permissions: staff read"
  on public.permissions for select to authenticated
  using (app.is_staff());

-- --------------------------------------------------------------------- roles
create policy "roles: staff read"
  on public.roles for select to authenticated
  using (app.is_staff());

-- Built-in roles (is_system) cannot be changed or deleted from the app.
create policy "roles: manage insert"
  on public.roles for insert to authenticated
  with check (app.has_permission('staff.manage') and not is_system);

create policy "roles: manage update"
  on public.roles for update to authenticated
  using      (app.has_permission('staff.manage') and not is_system)
  with check (app.has_permission('staff.manage') and not is_system);

create policy "roles: manage delete"
  on public.roles for delete to authenticated
  using (app.has_permission('staff.manage') and not is_system);

-- ---------------------------------------------------------- role_permissions
create policy "role_permissions: staff read"
  on public.role_permissions for select to authenticated
  using (app.is_staff());

create policy "role_permissions: manage insert"
  on public.role_permissions for insert to authenticated
  with check (app.has_permission('staff.manage'));

create policy "role_permissions: manage delete"
  on public.role_permissions for delete to authenticated
  using (app.has_permission('staff.manage'));

-- ---------------------------------------------------------------- staff_roles
create policy "staff_roles: read own or manager"
  on public.staff_roles for select to authenticated
  using (
    user_id = (select auth.uid())
    or app.has_permission('staff.manage')
  );

create policy "staff_roles: manage insert"
  on public.staff_roles for insert to authenticated
  with check (app.has_permission('staff.manage'));

create policy "staff_roles: manage update"
  on public.staff_roles for update to authenticated
  using      (app.has_permission('staff.manage'))
  with check (app.has_permission('staff.manage'));

create policy "staff_roles: manage delete"
  on public.staff_roles for delete to authenticated
  using (app.has_permission('staff.manage'));