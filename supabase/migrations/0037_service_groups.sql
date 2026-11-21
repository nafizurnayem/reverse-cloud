-- 0037_service_groups
-- Service groups power the mega-menu nav dropdown under the "Services" link.
-- Each group has a bilingual name and an ordered list of service members.
-- A service may belong to at most one group (enforced by unique constraint).

create table public.service_groups (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique
              check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en     text not null,
  name_bn     text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger service_groups_set_updated_at
  before update on public.service_groups
  for each row execute function app.set_updated_at();

-- Join table: each service belongs to at most one group.
create table public.service_group_members (
  group_id    uuid not null references public.service_groups (id) on delete cascade,
  service_id  uuid not null references public.services (id) on delete cascade,
  sort_order  integer not null default 0,
  primary key (group_id, service_id)
);

-- Enforce one-group-per-service
create unique index service_group_members_service_unique
  on public.service_group_members (service_id);

-- RLS
alter table public.service_groups enable row level security;
alter table public.service_group_members enable row level security;

create policy "service_groups: public read"
  on public.service_groups for select to anon, authenticated
  using (is_active);

create policy "service_groups: staff manage"
  on public.service_groups for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

create policy "service_group_members: public read"
  on public.service_group_members for select to anon, authenticated
  using (exists (
    select 1 from public.service_groups sg
    where sg.id = group_id and sg.is_active
  ));

create policy "service_group_members: staff manage"
  on public.service_group_members for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));
