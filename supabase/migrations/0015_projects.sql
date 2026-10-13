-- 0015_projects
-- Projects, team membership, milestones and project updates (plan section 5.3-B).
--
-- Two progress columns are maintained by trigger:
--   projects.progress_pct         -- staff view: all milestones regardless of visibility
--   projects.client_progress_pct  -- client view: only is_client_visible = true milestones
-- Both are NULL when there are no relevant milestones (not 0), so the UI can
-- distinguish "no milestones yet" from "0 % done".
--
-- Milestone weights must be positive and the total of all weights on a single
-- project must equal exactly 100 (enforced by a deferred constraint trigger so
-- that a batch INSERT/UPDATE inside one transaction still works).

-- ------------------------------------------------------------------ projects
create table public.projects (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.clients (id) on delete restrict,
  title                text not null check (char_length(btrim(title)) between 1 and 200),
  description          text          check (char_length(description) <= 5000),
  status               text not null default 'active'
                       check (status in ('active', 'on_hold', 'completed', 'cancelled')),
  preview_url          text          check (char_length(preview_url) <= 500),
  -- Staff-facing computed progress (all milestones).
  progress_pct         numeric(5,2)  check (progress_pct between 0 and 100),
  -- Client-facing computed progress (is_client_visible = true milestones only).
  client_progress_pct  numeric(5,2)  check (client_progress_pct between 0 and 100),
  starts_on            date,
  due_on               date,
  completed_at         timestamptz,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint projects_due_after_start check (due_on is null or starts_on is null or due_on >= starts_on)
);

create index projects_client_idx on public.projects (client_id);
create index projects_status_idx on public.projects (status) where status = 'active';

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function app.set_updated_at();

create trigger projects_audit
  after insert or update or delete on public.projects
  for each row execute function app.audit_row_change();

-- --------------------------------------------------------- project_members
-- Which staff members are assigned to a project (for developer-scoped RLS).
-- A project can have many members; a member can be on many projects.
create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references auth.users (id)      on delete cascade,
  role       text not null default 'developer'
             check (role in ('lead', 'developer', 'designer', 'qa', 'observer')),
  joined_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_idx on public.project_members (user_id);

-- ---------------------------------------------------------------- milestones
create table public.milestones (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  title             text not null check (char_length(btrim(title)) between 1 and 200),
  description       text          check (char_length(description) <= 3000),
  weight            numeric(5,2)  not null check (weight > 0),
  is_done           boolean       not null default false,
  is_client_visible boolean       not null default true,
  preview_url       text          check (char_length(preview_url) <= 500),
  due_on            date,
  done_at           timestamptz,
  sort_order        integer       not null default 0,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create index milestones_project_idx on public.milestones (project_id, sort_order);

create trigger milestones_set_updated_at
  before update on public.milestones
  for each row execute function app.set_updated_at();

create trigger milestones_audit
  after insert or update or delete on public.milestones
  for each row execute function app.audit_row_change();

-- --------------------------------------------------------- project_updates
-- Timestamped status posts written by staff; optionally visible to the client.
create table public.project_updates (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  author_id         uuid references auth.users (id) on delete set null,
  body              text not null check (char_length(btrim(body)) between 1 and 10000),
  is_client_visible boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index project_updates_project_idx on public.project_updates (project_id, created_at desc);

create trigger project_updates_set_updated_at
  before update on public.project_updates
  for each row execute function app.set_updated_at();

-- ------------------------------------------------- progress trigger function
-- Recalculates both progress columns on the parent project whenever any
-- milestone on that project is inserted, updated, or deleted.
--
-- Staff progress  = sum(weight of done milestones) / sum(weight of all milestones) * 100
-- Client progress = sum(weight of done AND visible milestones) / sum(weight of visible milestones) * 100
-- NULL when the denominator is zero (no milestones / no visible milestones).
create function app.recalc_project_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id      uuid;
  v_all_total       numeric;
  v_all_done        numeric;
  v_vis_total       numeric;
  v_vis_done        numeric;
  v_progress        numeric;
  v_client_progress numeric;
begin
  -- On DELETE, NEW is null, so we fall back to OLD.
  v_project_id := coalesce(new.project_id, old.project_id);

  select
    sum(m.weight)                                    as all_total,
    sum(m.weight) filter (where m.is_done)           as all_done,
    sum(m.weight) filter (where m.is_client_visible) as vis_total,
    sum(m.weight) filter (where m.is_client_visible
                            and m.is_done)           as vis_done
  into v_all_total, v_all_done, v_vis_total, v_vis_done
  from public.milestones m
  where m.project_id = v_project_id;

  -- Staff progress: NULL when no milestones exist yet.
  v_progress := case
    when coalesce(v_all_total, 0) = 0 then null
    else round((coalesce(v_all_done, 0) / v_all_total) * 100, 2)
  end;

  -- Client progress: NULL when no client-visible milestones exist yet.
  v_client_progress := case
    when coalesce(v_vis_total, 0) = 0 then null
    else round((coalesce(v_vis_done, 0) / v_vis_total) * 100, 2)
  end;

  update public.projects
     set progress_pct        = v_progress,
         client_progress_pct = v_client_progress
   where id = v_project_id;

  return null; -- AFTER trigger; return value is ignored
end;
$$;

create trigger milestones_recalc_progress
  after insert or update or delete on public.milestones
  for each row execute function app.recalc_project_progress();

-- ---------------------------------------- milestone weight constraint (total = 100)
-- DEFERRABLE INITIALLY DEFERRED fires at COMMIT time, not per-statement.
-- This allows inserting all milestones in one transaction without partial
-- violations, as long as they total 100 when the transaction commits.
create function app.check_milestone_weights()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_total      numeric;
begin
  v_project_id := coalesce(new.project_id, old.project_id);

  select coalesce(sum(weight), 0)
    into v_total
    from public.milestones
   where project_id = v_project_id;

  if v_total <> 100 then
    raise exception
      'milestone weights for project % must sum to 100, got %',
      v_project_id, v_total
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger milestones_weights_must_sum_to_100
  after insert or update or delete on public.milestones
  deferrable initially deferred
  for each row execute function app.check_milestone_weights();

-- ------------------------------------------------------- Row Level Security
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones      enable row level security;
alter table public.project_updates enable row level security;

-- ---- projects ----

-- Staff with projects.create or projects.update can read all projects.
create policy "projects: staff read"
  on public.projects for select to authenticated
  using (
    app.has_permission('projects.create')
    or app.has_permission('projects.update')
  );

-- Only staff with projects.create can insert.
create policy "projects: staff create"
  on public.projects for insert to authenticated
  with check (app.has_permission('projects.create'));

-- Both create and update permissions allow updating project rows.
-- progress_pct / client_progress_pct are written by the security-definer
-- trigger only, not by the API directly.
create policy "projects: staff update"
  on public.projects for update to authenticated
  using (
    app.has_permission('projects.create')
    or app.has_permission('projects.update')
  )
  with check (
    app.has_permission('projects.create')
    or app.has_permission('projects.update')
  );

-- Clients can see their own projects (not cancelled).
create policy "projects: client read own"
  on public.projects for select to authenticated
  using (
    client_id = app.my_client_id()
    and status in ('active', 'on_hold', 'completed')
  );

-- ---- project_members ----

create policy "project_members: staff read"
  on public.project_members for select to authenticated
  using (
    app.has_permission('projects.create')
    or app.has_permission('projects.update')
  );

-- Only creators can manage team membership.
create policy "project_members: staff manage"
  on public.project_members for all to authenticated
  using  (app.has_permission('projects.create'))
  with check (app.has_permission('projects.create'));

-- ---- milestones ----

create policy "milestones: staff read"
  on public.milestones for select to authenticated
  using (
    app.has_permission('projects.create')
    or app.has_permission('projects.update')
  );

-- projects.update is the permission for milestone writes.
create policy "milestones: staff write"
  on public.milestones for all to authenticated
  using  (app.has_permission('projects.update'))
  with check (app.has_permission('projects.update'));

-- Clients see only visible milestones on their own non-cancelled projects.
create policy "milestones: client read own"
  on public.milestones for select to authenticated
  using (
    is_client_visible = true
    and exists (
      select 1 from public.projects p
      where p.id = milestones.project_id
        and p.client_id = app.my_client_id()
        and p.status in ('active', 'on_hold', 'completed')
    )
  );

-- ---- project_updates ----

create policy "project_updates: staff read"
  on public.project_updates for select to authenticated
  using (
    app.has_permission('projects.create')
    or app.has_permission('projects.update')
  );

create policy "project_updates: staff write"
  on public.project_updates for all to authenticated
  using  (app.has_permission('projects.update'))
  with check (app.has_permission('projects.update'));

-- Clients see only client-visible updates on their own non-cancelled projects.
create policy "project_updates: client read own"
  on public.project_updates for select to authenticated
  using (
    is_client_visible = true
    and exists (
      select 1 from public.projects p
      where p.id = project_updates.project_id
        and p.client_id = app.my_client_id()
        and p.status in ('active', 'on_hold', 'completed')
    )
  );

-- -------------------------------------------------------- table-level grants

-- projects
revoke all on public.projects from anon, authenticated;
grant select on public.projects to authenticated;
grant insert (client_id, title, description, status, preview_url,
              starts_on, due_on, completed_at, created_by)
  on public.projects to authenticated;
-- progress_pct and client_progress_pct intentionally excluded:
-- they are written only by the security-definer trigger.
grant update (title, description, status, preview_url, starts_on, due_on, completed_at)
  on public.projects to authenticated;

-- project_members
revoke all on public.project_members from anon, authenticated;
grant select                              on public.project_members to authenticated;
grant insert (project_id, user_id, role) on public.project_members to authenticated;
grant update (role)                      on public.project_members to authenticated;
grant delete                             on public.project_members to authenticated;

-- milestones
revoke all on public.milestones from anon, authenticated;
grant select on public.milestones to authenticated;
grant insert (project_id, title, description, weight, is_done, is_client_visible,
              preview_url, due_on, done_at, sort_order, created_by)
  on public.milestones to authenticated;
grant update (title, description, weight, is_done, is_client_visible,
              preview_url, due_on, done_at, sort_order)
  on public.milestones to authenticated;
grant delete on public.milestones to authenticated;

-- project_updates
revoke all on public.project_updates from anon, authenticated;
grant select on public.project_updates to authenticated;
grant insert (project_id, author_id, body, is_client_visible)
  on public.project_updates to authenticated;
grant update (body, is_client_visible)
  on public.project_updates to authenticated;
grant delete on public.project_updates to authenticated;
