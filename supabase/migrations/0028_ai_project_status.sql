-- 0028_ai_project_status
-- Provides a strictly isolated, read-only interface for the AI agent (and authenticated clients)
-- to query project status, client-visible milestones, and progress (Phase 5 / Wave 2, §8.7).
--
-- SECURITY GUARANTEES:
-- 1. Direct table access on projects, milestones, project_updates, and internal_notes
--    remains strictly REVOKED from the ai_service role.
-- 2. get_client_project_status validates caller identity:
--    - ai_service: may query project status for a supplied client_id.
--    - authenticated: client users can ONLY query for their own client_id; staff with projects.create/update may query any.
--    - anon: rejected with 42501 (permission_denied).
-- 3. Cross-client isolation: querying (Client A, Project B) returns zero rows.
-- 4. Information hiding: milestones and updates with is_client_visible = false are filtered out.
-- 5. Cancelled projects are excluded from client queries.

create or replace function public.get_client_project_status(
  p_client_id  uuid,
  p_project_id uuid default null
)
returns table (
  project_id          uuid,
  title               text,
  description         text,
  status              text,
  client_progress_pct numeric,
  due_on              date,
  preview_url         text,
  milestones          jsonb,
  recent_updates      jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  v_role := nullif(current_setting('role', true), 'none');

  -- Verify authorization
  if (select auth.uid()) is not null then
    -- Authenticated client can only query their own client_id; staff with projects permissions may query any
    if not (
      app.my_client_id() = p_client_id
      or app.has_permission('projects.create')
      or app.has_permission('projects.update')
    ) then
      raise exception 'permission_denied' using errcode = '42501';
    end if;
  elsif session_user = 'ai_service' or v_role = 'ai_service' or session_user = 'postgres' then
    -- Authorized AI service background process or database administrator
    null;
  else
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if p_client_id is null then
    return;
  end if;

  return query
  select
    p.id as project_id,
    p.title,
    p.description,
    p.status,
    p.client_progress_pct,
    p.due_on,
    p.preview_url,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'title', m.title,
            'weight', m.weight,
            'is_done', m.is_done,
            'due_on', m.due_on,
            'preview_url', m.preview_url
          ) order by m.sort_order, m.created_at
        )
        from public.milestones m
        where m.project_id = p.id
          and m.is_client_visible = true
      ),
      '[]'::jsonb
    ) as milestones,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', u.id,
            'body', u.body,
            'created_at', u.created_at
          ) order by u.created_at desc
        )
        from (
          select pu.id, pu.body, pu.created_at
          from public.project_updates pu
          where pu.project_id = p.id
            and pu.is_client_visible = true
          order by pu.created_at desc
          limit 5
        ) u
      ),
      '[]'::jsonb
    ) as recent_updates
  from public.projects p
  where p.client_id = p_client_id
    and (p_project_id is null or p.id = p_project_id)
    and p.status in ('active', 'on_hold', 'completed')
  order by p.created_at desc;
end;
$$;

-- Explicit permissions
revoke all on function public.get_client_project_status(uuid, uuid) from public, anon;
grant execute on function public.get_client_project_status(uuid, uuid) to ai_service, authenticated;
