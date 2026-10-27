-- 0030_staff_directory_and_reviews.sql
-- Fixes for:
--   FX-05: Filter list_staff_directory to staff-roles only + exact email lookup for staff management
--   FX-09: Add submit_project_review RPC for clients to safely review their own projects

-- -----------------------------------------------------------------------------
-- FX-05: list_staff_directory: return ONLY users who hold an active or assigned staff role
-- -----------------------------------------------------------------------------
create or replace function public.list_staff_directory()
returns table (
  user_id uuid,
  email text,
  full_name text,
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
  select u.id, u.email::text, p.full_name, u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
   where exists (
     select 1 from public.staff_roles sr
      where sr.user_id = u.id
   )
   order by coalesce(p.full_name, u.email::text, u.id::text), u.id;
end;
$$;

revoke all on function public.list_staff_directory() from public, anon;
grant execute on function public.list_staff_directory() to authenticated;

-- -----------------------------------------------------------------------------
-- FX-05: lookup_user_by_email: lookup a single user by exact email to add as staff
-- -----------------------------------------------------------------------------
create or replace function public.lookup_user_by_email(p_email text)
returns table (
  user_id uuid,
  email text,
  full_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_clean text := btrim(coalesce(p_email, ''));
begin
  if (select auth.uid()) is null or not app.has_permission('staff.manage') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if v_clean = '' then
    return;
  end if;

  return query
  select u.id, u.email::text, p.full_name
    from auth.users u
    left join public.profiles p on p.id = u.id
   where lower(u.email::text) = lower(v_clean)
   limit 1;
end;
$$;

revoke all on function public.lookup_user_by_email(text) from public, anon;
grant execute on function public.lookup_user_by_email(text) to authenticated;

-- -----------------------------------------------------------------------------
-- FX-09: submit_project_review: verify client ownership and submit review as pending
-- -----------------------------------------------------------------------------
create or replace function public.submit_project_review(
  p_project_id uuid,
  p_rating smallint,
  p_reviewer_name text,
  p_reviewer_title text default null,
  p_body text default '',
  p_locale text default 'en'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid := app.my_client_id();
  v_project_client_id uuid;
  v_review_id uuid;
  v_existing_id uuid;
begin
  if (select auth.uid()) is null or v_client_id is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_project_id is null then
    raise exception 'invalid_project' using errcode = '22023';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_reviewer_name, '')), '') is null then
    raise exception 'invalid_reviewer_name' using errcode = '22023';
  end if;

  -- Ensure project exists and belongs to the caller's client account
  select client_id into v_project_client_id
    from public.projects
   where id = p_project_id;

  if not found or v_project_client_id is distinct from v_client_id then
    raise exception 'project_not_found_or_forbidden' using errcode = '42501';
  end if;

  -- One portal review per project: update existing or insert new
  select id into v_existing_id
    from public.reviews
   where project_id = p_project_id
     and source = 'portal'
   limit 1;

  if v_existing_id is not null then
    update public.reviews
       set rating = p_rating,
           reviewer_name = btrim(p_reviewer_name),
           reviewer_title = nullif(btrim(coalesce(p_reviewer_title, '')), ''),
           body = coalesce(p_body, ''),
           locale = case when p_locale = 'bn' then 'bn' else 'en' end,
           status = 'pending',
           updated_at = now()
     where id = v_existing_id
    returning id into v_review_id;
  else
    insert into public.reviews (
      project_id,
      client_id,
      reviewer_name,
      reviewer_title,
      rating,
      body,
      locale,
      source,
      status,
      is_featured
    ) values (
      p_project_id,
      v_client_id,
      btrim(p_reviewer_name),
      nullif(btrim(coalesce(p_reviewer_title, '')), ''),
      p_rating,
      coalesce(p_body, ''),
      case when p_locale = 'bn' then 'bn' else 'en' end,
      'portal',
      'pending',
      false
    )
    returning id into v_review_id;
  end if;

  return v_review_id;
end;
$$;

revoke all on function public.submit_project_review(uuid, smallint, text, text, text, text) from public, anon;
grant execute on function public.submit_project_review(uuid, smallint, text, text, text, text) to authenticated;
