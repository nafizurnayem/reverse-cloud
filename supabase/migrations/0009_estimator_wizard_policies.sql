-- 0009_estimator_wizard_policies
-- Access rules, the "no edits to a used version" guard, and the clone/activate
-- functions for the estimator (plan sections 5.4 and 5.5).
--
-- estimator_*   : staff with estimator.manage only. FastAPI reads these later
--                 through its own limited database role (added with FastAPI).
-- estimates     : staff with leads.read can read. FastAPI inserts them later.
-- wizard_*      : visitors read active questions; staff with content.manage edit.

-- ------------------------------------------------------- guard: no edits to used versions
-- A version that is active or archived is "laminated": its rates, factors and
-- exchange settings cannot change. Clone it into a new draft to make changes.
-- SECURITY DEFINER so the check works whoever makes the change.
create function app.guard_estimator_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'estimator version % is %: it cannot be deleted', old.version, old.status
        using errcode = '55000';
    end if;
    return old;
  end if;

  if old.status <> 'draft' and (
       new.version           is distinct from old.version
    or new.usd_to_bdt        is distinct from old.usd_to_bdt
    or new.bdt_multiplier    is distinct from old.bdt_multiplier
    or new.rounding_step_usd is distinct from old.rounding_step_usd
  ) then
    raise exception 'estimator version % is %: clone it to a new draft to change it',
      old.version, old.status
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create function app.guard_estimator_children()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s_old text;
  s_new text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into s_old from public.estimator_versions where id = old.version_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select status into s_new from public.estimator_versions where id = new.version_id;
  end if;

  if coalesce(s_old, 'draft') <> 'draft' or coalesce(s_new, 'draft') <> 'draft' then
    raise exception 'this estimator version is active or archived: clone it to a new draft to change it'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger estimator_versions_guard
  before update or delete on public.estimator_versions
  for each row execute function app.guard_estimator_version();

create trigger estimator_service_rates_guard
  before insert or update or delete on public.estimator_service_rates
  for each row execute function app.guard_estimator_children();

create trigger estimator_factors_guard
  before insert or update or delete on public.estimator_factors
  for each row execute function app.guard_estimator_children();

-- ---------------------------------------------------------------- estimator
create policy "estimator_versions: staff manage"
  on public.estimator_versions for all to authenticated
  using      (app.has_permission('estimator.manage'))
  with check (app.has_permission('estimator.manage'));

create policy "estimator_service_rates: staff manage"
  on public.estimator_service_rates for all to authenticated
  using      (app.has_permission('estimator.manage'))
  with check (app.has_permission('estimator.manage'));

create policy "estimator_factors: staff manage"
  on public.estimator_factors for all to authenticated
  using      (app.has_permission('estimator.manage'))
  with check (app.has_permission('estimator.manage'));

-- Estimates are read-only for staff. They are created by the FastAPI service.
create policy "estimates: staff read"
  on public.estimates for select to authenticated
  using (app.has_permission('leads.read'));

-- ------------------------------------------------------------------- wizard
create policy "wizard_questions: public read"
  on public.wizard_questions for select to anon, authenticated
  using (is_active);

create policy "wizard_questions: staff manage"
  on public.wizard_questions for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

create policy "wizard_options: public read"
  on public.wizard_options for select to anon, authenticated
  using (exists (
    select 1 from public.wizard_questions q
    where q.id = question_id and q.is_active
  ));

create policy "wizard_options: staff manage"
  on public.wizard_options for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

create policy "wizard_option_scores: public read"
  on public.wizard_option_scores for select to anon, authenticated
  using (exists (
    select 1
    from public.wizard_options o
    join public.wizard_questions q on q.id = o.question_id
    where o.id = option_id and q.is_active
  ));

create policy "wizard_option_scores: staff manage"
  on public.wizard_option_scores for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

-- --------------------------------------------------- function: clone a version
-- Copies a version (settings, rates and factors) into a new draft and returns
-- the new id. Runs with the caller's own permissions.
create function public.clone_estimator_version(source_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not app.has_permission('estimator.manage') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.estimator_versions where id = source_id) then
    raise exception 'estimator version not found' using errcode = 'P0002';
  end if;

  insert into public.estimator_versions
    (version, status, usd_to_bdt, bdt_multiplier, rounding_step_usd, created_by)
  select (select coalesce(max(version), 0) + 1 from public.estimator_versions),
         'draft', usd_to_bdt, bdt_multiplier, rounding_step_usd, (select auth.uid())
  from public.estimator_versions
  where id = source_id
  returning id into new_id;

  insert into public.estimator_service_rates
    (version_id, service_id, base_min, base_max, weeks_min, weeks_max)
  select new_id, service_id, base_min, base_max, weeks_min, weeks_max
  from public.estimator_service_rates
  where version_id = source_id;

  insert into public.estimator_factors
    (version_id, kind, key, label_en, label_bn, service_id, multiplier,
     add_min, add_max, add_weeks_min, add_weeks_max, monthly_min, monthly_max, sort_order)
  select new_id, kind, key, label_en, label_bn, service_id, multiplier,
         add_min, add_max, add_weeks_min, add_weeks_max, monthly_min, monthly_max, sort_order
  from public.estimator_factors
  where version_id = source_id;

  return new_id;
end;
$$;

-- ----------------------------------------------- function: activate a version
-- Archives the current active version and activates this one, in one step.
-- A version with no service rates cannot be activated. An archived version can
-- be activated again (a rollback).
create function public.activate_estimator_version(target_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  if not app.has_permission('estimator.manage') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select status into v_status from public.estimator_versions where id = target_id;
  if v_status is null then
    raise exception 'estimator version not found' using errcode = 'P0002';
  end if;
  if v_status = 'active' then
    return;
  end if;

  if not exists (
    select 1 from public.estimator_service_rates where version_id = target_id
  ) then
    raise exception 'this estimator version has no service rates'
      using errcode = '55000';
  end if;

  update public.estimator_versions set status = 'archived' where status = 'active';
  update public.estimator_versions
     set status = 'active', activated_at = now()
   where id = target_id;
end;
$$;

-- Only signed-in users may call the functions (and they check permissions too).
revoke execute on function public.clone_estimator_version(uuid)    from public, anon;
revoke execute on function public.activate_estimator_version(uuid) from public, anon;
grant  execute on function public.clone_estimator_version(uuid)    to authenticated;
grant  execute on function public.activate_estimator_version(uuid) to authenticated;