-- 0017_internal_notes
-- Staff-only private notes attachable to any project-domain entity
-- (plan section 5.3-B: internal_notes).
--
-- Notes are never visible to clients. Any active staff member can read all
-- notes. Writing (insert / update / delete) is open to any staff member too,
-- but authors can only update or delete their own notes unless they hold
-- staff.manage.
--
-- entity_type is a controlled vocabulary matching the table names used as
-- audit_log.entity_type so the two can be correlated easily.

-- ------------------------------------------------------------- internal_notes
create table public.internal_notes (
  id          uuid        primary key default gen_random_uuid(),
  entity_type text        not null
              check (entity_type in (
                'project', 'milestone', 'payment_item', 'payment',
                'client',  'lead'
              )),
  entity_id   uuid        not null,
  body        text        not null check (char_length(btrim(body)) between 1 and 10000),
  author_id   uuid        references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Most reads are "all notes for a given entity" (e.g. notes on project X).
create index internal_notes_entity_idx
  on public.internal_notes (entity_type, entity_id, created_at desc);

-- Secondary index for "all notes written by a staff member".
create index internal_notes_author_idx
  on public.internal_notes (author_id, created_at desc)
  where author_id is not null;

create trigger internal_notes_set_updated_at
  before update on public.internal_notes
  for each row execute function app.set_updated_at();

create trigger internal_notes_audit
  after insert or update or delete on public.internal_notes
  for each row execute function app.audit_row_change();

-- ------------------------------------------------------- Row Level Security
alter table public.internal_notes enable row level security;

-- All active staff can read every note.
create policy "internal_notes: staff read"
  on public.internal_notes for select to authenticated
  using (app.is_staff());

-- Any active staff member can create a note.
create policy "internal_notes: staff insert"
  on public.internal_notes for insert to authenticated
  with check (app.is_staff());

-- Authors can edit their own notes. Staff managers can edit any note.
create policy "internal_notes: staff update"
  on public.internal_notes for update to authenticated
  using (
    app.is_staff()
    and (
      author_id = (select auth.uid())
      or app.has_permission('staff.manage')
    )
  )
  with check (
    app.is_staff()
    and (
      author_id = (select auth.uid())
      or app.has_permission('staff.manage')
    )
  );

-- Authors can delete their own notes. Staff managers can delete any note.
create policy "internal_notes: staff delete"
  on public.internal_notes for delete to authenticated
  using (
    app.is_staff()
    and (
      author_id = (select auth.uid())
      or app.has_permission('staff.manage')
    )
  );

-- No client policy: clients can never see or touch internal notes.

-- -------------------------------------------------------- table-level grants
revoke all on public.internal_notes from anon, authenticated;
grant select on public.internal_notes to authenticated;
grant insert (entity_type, entity_id, body, author_id)
  on public.internal_notes to authenticated;
-- Authors may correct the body; they cannot reassign entity_type, entity_id,
-- or author_id after creation.
grant update (body)
  on public.internal_notes to authenticated;
grant delete on public.internal_notes to authenticated;
