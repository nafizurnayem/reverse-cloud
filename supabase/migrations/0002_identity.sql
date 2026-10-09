-- 0002_identity
-- Users' profiles, staff roles and permissions (plan sections 3 and 5.3-A).
-- Row Level Security is switched ON here. With no policies yet, the public API
-- can read and write nothing. Policies arrive in 0003.

-- "app" is a private schema for helper functions. It is NOT exposed via the API.
create schema if not exists app;

-- Keeps updated_at current on any table that has the column.
create function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  full_name        text,
  avatar_url       text,
  phone            text,
  preferred_locale text not null default 'en' check (preferred_locale in ('en', 'bn')),
  timezone         text not null default 'Asia/Dhaka',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();

-- ------------------------------------------------------------------- roles
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------- permissions
create table public.permissions (
  key         text primary key,
  description text not null
);

-- -------------------------------------------------------- role_permissions
create table public.role_permissions (
  role_id        uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create index role_permissions_permission_idx on public.role_permissions (permission_key);

-- ------------------------------------------------------------- staff_roles
-- Which staff member holds which role. Deactivate instead of deleting.
create table public.staff_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role_id    uuid not null references public.roles (id) on delete restrict,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index staff_roles_active_user_idx on public.staff_roles (user_id) where is_active;

-- --------------------------------------------- auto-create a profile on signup
create function app.handle_new_user()
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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- --------------------------------------------------------------------- RLS
alter table public.profiles         enable row level security;
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_roles      enable row level security;