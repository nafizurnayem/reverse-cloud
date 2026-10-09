-- 0005_audit_log
-- Append-only record of changes to sensitive tables (plan section 5.3-A).
-- Rows are written only by the trigger below. Nobody can edit or delete them
-- through the API.

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,                 -- who did it (null = done by SQL/system, not a signed-in user)
  action      text not null check (action in ('insert', 'update', 'delete')),
  entity_type text not null,        -- table name, e.g. 'staff_roles'
  entity_id   text,                 -- row id; text so tables with 2-column keys work too
  before      jsonb,                -- the row before the change (update, delete)
  after       jsonb,                -- the row after the change (insert, update)
  created_at  timestamptz not null default now()
);

create index audit_log_entity_idx  on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx   on public.audit_log (actor_id, created_at desc);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- ------------------------------------------------------------------ access
alter table public.audit_log enable row level security;

create policy "audit_log: read with permission"
  on public.audit_log for select to authenticated
  using (app.has_permission('audit.read'));

-- Belt and braces: even apart from RLS, remove the ability to write at all.
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
revoke update, delete, truncate on public.audit_log from service_role;

-- ----------------------------------------------------------- trigger function
-- Usage:  execute function app.audit_row_change()                    -- key column is "id"
--         execute function app.audit_row_change('user_id', 'role_id') -- 2-column key
create function app.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j_old jsonb;
  j_new jsonb;
  j     jsonb;
  eid   text;
  i     int;
begin
  if tg_op in ('UPDATE', 'DELETE') then j_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then j_new := to_jsonb(new); end if;
  j := coalesce(j_new, j_old);

  if tg_nargs = 0 then
    eid := j ->> 'id';
  else
    for i in 0 .. tg_nargs - 1 loop
      eid := concat_ws(':', eid, j ->> tg_argv[i]);
    end loop;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, before, after)
  values ((select auth.uid()), lower(tg_op), tg_table_name, eid, j_old, j_new);

  return null;  -- AFTER trigger: the return value is ignored
end;
$$;

-- ----------------------------------------------------------- watched tables
create trigger staff_roles_audit
  after insert or update or delete on public.staff_roles
  for each row execute function app.audit_row_change('user_id', 'role_id');