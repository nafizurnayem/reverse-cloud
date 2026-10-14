-- 0021_project_admin_functions
-- Transaction-safe milestone editing and a restricted staff directory for the
-- project admin. New projects start on hold and can activate only with a full
-- milestone plan.

alter table public.projects alter column status set default 'on_hold';

create function app.guard_project_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    select coalesce(sum(weight), 0)
      into v_total
      from public.milestones
     where project_id = new.id;
    if v_total <> 100 then
      raise exception 'project_activation_needs_100'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger projects_guard_activation
  before update of status on public.projects
  for each row execute function app.guard_project_activation();

create function public.list_project_staff()
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  role_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         p.full_name,
         p.avatar_url,
         array_agg(distinct r.name order by r.name)
    from public.profiles p
    join public.staff_roles sr on sr.user_id = p.id and sr.is_active
    join public.roles r on r.id = sr.role_id
   where app.has_permission('projects.create')
      or app.has_permission('projects.update')
   group by p.id, p.full_name, p.avatar_url
   order by coalesce(p.full_name, ''), p.id;
$$;

create function public.replace_project_milestones(
  p_project_id uuid,
  p_milestones jsonb
)
returns setof public.milestones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_keep_ids uuid[] := '{}'::uuid[];
  v_total numeric := 0;
  v_count integer;
begin
  if not app.has_permission('projects.update') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id for update) then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_milestones) <> 'array' then
    raise exception 'invalid_milestone_plan' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_milestones);
  if v_count < 1 or v_count > 100 then
    raise exception 'invalid_milestone_plan' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_milestones)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or char_length(btrim(coalesce(v_item->>'title', ''))) not between 1 and 200
       or char_length(coalesce(v_item->>'description', '')) > 3000
       or char_length(coalesce(v_item->>'preview_url', '')) > 500
       or coalesce((v_item->>'weight')::numeric, 0) <= 0 then
      raise exception 'invalid_milestone_plan' using errcode = '22023';
    end if;
    v_total := v_total + (v_item->>'weight')::numeric;
  end loop;
  if v_total <> 100 then
    raise exception 'milestone_weights_must_sum_to_100' using errcode = '23514';
  end if;

  for v_item in select value from jsonb_array_elements(p_milestones)
  loop
    v_id := nullif(v_item->>'id', '')::uuid;
    if v_id is not null then
      if v_id = any(v_keep_ids)
         or not exists (select 1 from public.milestones where id = v_id and project_id = p_project_id) then
        raise exception 'invalid_milestone_plan' using errcode = '22023';
      end if;
      update public.milestones
         set title = btrim(v_item->>'title'),
             description = nullif(btrim(coalesce(v_item->>'description', '')), ''),
             weight = (v_item->>'weight')::numeric,
             is_done = coalesce((v_item->>'is_done')::boolean, false),
             is_client_visible = coalesce((v_item->>'is_client_visible')::boolean, true),
             preview_url = nullif(btrim(coalesce(v_item->>'preview_url', '')), ''),
             due_on = nullif(v_item->>'due_on', '')::date,
             done_at = case
               when coalesce((v_item->>'is_done')::boolean, false) then coalesce(done_at, now())
               else null
             end,
             sort_order = coalesce((v_item->>'sort_order')::integer, 0)
       where id = v_id and project_id = p_project_id;
    else
      insert into public.milestones (
        project_id, title, description, weight, is_done, is_client_visible,
        preview_url, due_on, done_at, sort_order, created_by
      ) values (
        p_project_id,
        btrim(v_item->>'title'),
        nullif(btrim(coalesce(v_item->>'description', '')), ''),
        (v_item->>'weight')::numeric,
        coalesce((v_item->>'is_done')::boolean, false),
        coalesce((v_item->>'is_client_visible')::boolean, true),
        nullif(btrim(coalesce(v_item->>'preview_url', '')), ''),
        nullif(v_item->>'due_on', '')::date,
        case when coalesce((v_item->>'is_done')::boolean, false) then now() else null end,
        coalesce((v_item->>'sort_order')::integer, 0),
        auth.uid()
      ) returning id into v_id;
    end if;
    v_keep_ids := array_append(v_keep_ids, v_id);
  end loop;

  delete from public.milestones
   where project_id = p_project_id
     and not (id = any(v_keep_ids));

  return query
    select * from public.milestones
     where project_id = p_project_id
     order by sort_order, created_at;
end;
$$;

revoke all on function public.list_project_staff() from public, anon, authenticated;
revoke all on function public.replace_project_milestones(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.list_project_staff() to authenticated;
grant execute on function public.replace_project_milestones(uuid, jsonb) to authenticated;
