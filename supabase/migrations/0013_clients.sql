-- 0013_clients
-- Client records, the helper that finds the signed-in client, and the link from
-- leads to clients (plan sections 5.3-B and 5.4).
--
-- A client row exists before the person has an account (staff create it, or a
-- Fiverr/Upwork buyer is added by hand). user_id stays empty until the person
-- accepts an invitation or signs in with a matching confirmed email. That
-- linking is done only by the functions in 0014, never directly from the app.

-- ------------------------------------------------------------------ clients
create table public.clients (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid unique references auth.users (id) on delete set null,
  full_name        text not null check (char_length(btrim(full_name)) between 1 and 200),
  email            extensions.citext unique,
  phone            text check (char_length(phone) <= 40),
  company          text check (char_length(company) <= 200),
  country          text check (char_length(country) <= 100),
  timezone         text check (char_length(timezone) <= 64),
  preferred_locale text not null default 'en' check (preferred_locale in ('en', 'bn')),
  stage            text not null default 'prospect'
                   check (stage in ('prospect', 'active', 'past')),
  source           text not null default 'website'
                   check (source in ('website', 'fiverr', 'upwork', 'referral', 'walk_in', 'other')),
  source_ref       text check (char_length(source_ref) <= 200),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint clients_email_format check (
    email is null or email::text ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function app.set_updated_at();

create trigger clients_audit
  after insert or update or delete on public.clients
  for each row execute function app.audit_row_change();

-- The signed-in user's own client row (null for staff and for people with no
-- client record). Used by the policies of every client-facing table.
create or replace function app.my_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.clients c
  where c.user_id = (select auth.uid())
    and c.archived_at is null
$$;

-- Now that clients exists, leads can point to it.
alter table public.leads
  add constraint leads_converted_client_id_fkey
  foreign key (converted_client_id) references public.clients (id) on delete set null;

-- ------------------------------------------------------- Row Level Security
alter table public.clients enable row level security;

-- Staff with clients.manage see and manage every client.
create policy "clients: staff read"
  on public.clients for select to authenticated
  using (app.has_permission('clients.manage'));

create policy "clients: staff add"
  on public.clients for insert to authenticated
  with check (app.has_permission('clients.manage'));

create policy "clients: staff update"
  on public.clients for update to authenticated
  using      (app.has_permission('clients.manage'))
  with check (app.has_permission('clients.manage'));

-- A client sees and edits only their own row.
create policy "clients: own read"
  on public.clients for select to authenticated
  using (user_id = (select auth.uid()) and archived_at is null);

create policy "clients: own update"
  on public.clients for update to authenticated
  using      (user_id = (select auth.uid()) and archived_at is null)
  with check (user_id = (select auth.uid()));

-- No delete policy: clients are archived (archived_at), never deleted.

-- Table permissions. user_id is left out of every grant on purpose: it can only
-- be set by the security-definer functions in 0014.
revoke all on public.clients from anon, authenticated;
grant select on public.clients to authenticated;
grant insert (full_name, email, phone, company, country, timezone,
              preferred_locale, stage, source, source_ref)
  on public.clients to authenticated;
grant update (full_name, email, phone, company, country, timezone,
              preferred_locale, stage, source, source_ref, archived_at)
  on public.clients to authenticated;

-- Column permissions cannot tell staff from clients, so this trigger does it:
-- a client may change only name, phone, company, timezone and language.
create function app.guard_client_self_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and not app.has_permission('clients.manage')
     and (   new.email       is distinct from old.email
          or new.country     is distinct from old.country
          or new.stage       is distinct from old.stage
          or new.source      is distinct from old.source
          or new.source_ref  is distinct from old.source_ref
          or new.archived_at is distinct from old.archived_at
          or new.created_by  is distinct from old.created_by
          or new.user_id     is distinct from old.user_id)
  then
    raise exception 'clients: only staff can change these fields'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger clients_guard_self_update
  before update on public.clients
  for each row execute function app.guard_client_self_update();