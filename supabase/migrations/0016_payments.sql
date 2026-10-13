-- 0016_payments
-- Payment schedule (payment_items) and recorded payments (plan section 5.3-B).
--
-- CURRENCY SAFETY
-- Both tables carry a `currency` column. The FK from `payments` to
-- `payment_items` is composite: (payment_item_id, currency) — so Postgres
-- rejects any attempt to record a payment in a different currency than the
-- item it belongs to. This requires the unique constraint
-- payment_items(id, currency) which is declared alongside the PK.
--
-- AUTO-PAID TRIGGER
-- After every insert, update, or delete on `payments`, the trigger
-- `payments_auto_mark_item_paid` recalculates the total received for the
-- affected item. When total >= amount_due the item is flipped to 'paid'
-- and paid_at is stamped. If payments are later reduced below the threshold,
-- the item reverts to 'pending'. Cancelled items are never touched.

-- -------------------------------------------------------------- payment_items
-- One row per scheduled installment on a project (e.g. "30 % deposit").
create table public.payment_items (
  id          uuid          primary key default gen_random_uuid(),
  project_id  uuid          not null references public.projects (id) on delete restrict,
  title       text          not null check (char_length(btrim(title)) between 1 and 200),
  description text                   check (char_length(description) <= 2000),
  amount_due  numeric(14,2) not null  check (amount_due > 0),
  currency    text          not null  default 'USD'
              check (char_length(currency) = 3),   -- ISO-4217 three-letter code
  status      text          not null  default 'pending'
              check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  due_on      date,
  paid_at     timestamptz,                          -- stamped automatically by trigger
  sort_order  integer       not null  default 0,
  created_by  uuid          references auth.users (id) on delete set null,
  created_at  timestamptz   not null  default now(),
  updated_at  timestamptz   not null  default now(),
  -- Required for the composite FK from payments(payment_item_id, currency).
  unique (id, currency)
);

create index payment_items_project_idx on public.payment_items (project_id, sort_order);

create trigger payment_items_set_updated_at
  before update on public.payment_items
  for each row execute function app.set_updated_at();

create trigger payment_items_audit
  after insert or update or delete on public.payment_items
  for each row execute function app.audit_row_change();

-- ------------------------------------------------------------------ payments
-- One row per actual received payment against a payment_item.
-- The composite FK (payment_item_id, currency) enforces currency consistency:
-- you cannot record a USD payment against a GBP item.
create table public.payments (
  id              uuid          primary key default gen_random_uuid(),
  payment_item_id uuid          not null,
  currency        text          not null check (char_length(currency) = 3),
  amount_paid     numeric(14,2) not null check (amount_paid > 0),
  paid_at         timestamptz   not null default now(),
  method          text
                  check (method is null or
                         method in ('bank_transfer', 'card', 'mobile_banking',
                                    'cash', 'crypto', 'other')),
  reference       text          check (char_length(reference) <= 200),
  notes           text          check (char_length(notes) <= 2000),
  recorded_by     uuid          references auth.users (id) on delete set null,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  -- Currency-safe composite FK.
  constraint payments_item_currency_fk
    foreign key (payment_item_id, currency)
    references public.payment_items (id, currency)
    on delete restrict
);

create index payments_item_idx on public.payments (payment_item_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function app.set_updated_at();

create trigger payments_audit
  after insert or update or delete on public.payments
  for each row execute function app.audit_row_change();

-- ---------------------------------------------------------- auto-paid trigger
-- Fires after any insert, update, or delete on payments.
-- Recalculates total received for the affected payment_item and flips
-- payment_items.status accordingly. Never touches a cancelled item.
create function app.recalc_payment_item_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_id    uuid;
  v_amount_due numeric;
  v_item_status text;
  v_total_paid numeric;
begin
  -- On DELETE, NEW is null so fall back to OLD.
  v_item_id := coalesce(new.payment_item_id, old.payment_item_id);

  select pi.amount_due, pi.status
    into v_amount_due, v_item_status
    from public.payment_items pi
   where pi.id = v_item_id;

  -- Never touch a cancelled item.
  if not found or v_item_status = 'cancelled' then
    return null;
  end if;

  select coalesce(sum(p.amount_paid), 0)
    into v_total_paid
    from public.payments p
   where p.payment_item_id = v_item_id;

  if v_total_paid >= v_amount_due then
    -- Mark as paid and stamp paid_at (keep existing stamp if already paid).
    update public.payment_items
       set status  = 'paid',
           paid_at = coalesce(paid_at, now())
     where id     = v_item_id
       and status <> 'paid';    -- avoid a no-op write
  else
    -- Payments reduced below threshold: revert to pending.
    update public.payment_items
       set status  = 'pending',
           paid_at = null
     where id     = v_item_id
       and status  = 'paid';
  end if;

  return null; -- AFTER trigger; return value is ignored
end;
$$;

create trigger payments_auto_mark_item_paid
  after insert or update or delete on public.payments
  for each row execute function app.recalc_payment_item_status();

-- ------------------------------------------------------- Row Level Security
alter table public.payment_items enable row level security;
alter table public.payments      enable row level security;

-- ---- payment_items ----

-- Staff with payments.manage or payments.read can see all items.
create policy "payment_items: staff read"
  on public.payment_items for select to authenticated
  using (
    app.has_permission('payments.manage')
    or app.has_permission('payments.read')
  );

-- Only payments.manage can write (insert / update / delete) items.
create policy "payment_items: staff write"
  on public.payment_items for all to authenticated
  using  (app.has_permission('payments.manage'))
  with check (app.has_permission('payments.manage'));

-- Clients can see the payment schedule for their own non-cancelled projects
-- so the portal can show what is due and when.
create policy "payment_items: client read own"
  on public.payment_items for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = payment_items.project_id
        and p.client_id = app.my_client_id()
        and p.status in ('active', 'on_hold', 'completed')
    )
  );

-- ---- payments ----

-- Staff with payments.manage or payments.read can see all payments.
create policy "payments: staff read"
  on public.payments for select to authenticated
  using (
    app.has_permission('payments.manage')
    or app.has_permission('payments.read')
  );

-- Only payments.manage can record or edit payments.
create policy "payments: staff write"
  on public.payments for all to authenticated
  using  (app.has_permission('payments.manage'))
  with check (app.has_permission('payments.manage'));

-- Clients can see payment records against their own items so they know
-- what has been acknowledged as received.
create policy "payments: client read own"
  on public.payments for select to authenticated
  using (
    exists (
      select 1
        from public.payment_items pi
        join public.projects p on p.id = pi.project_id
       where pi.id = payments.payment_item_id
         and p.client_id = app.my_client_id()
         and p.status in ('active', 'on_hold', 'completed')
    )
  );

-- -------------------------------------------------------- table-level grants

-- payment_items
revoke all on public.payment_items from anon, authenticated;
grant select on public.payment_items to authenticated;
grant insert (project_id, title, description, amount_due, currency,
              status, due_on, sort_order, created_by)
  on public.payment_items to authenticated;
-- Staff may manually set status (e.g. 'overdue', 'cancelled') and correct
-- paid_at if needed. The trigger also writes status and paid_at.
grant update (title, description, amount_due, currency, status,
              due_on, paid_at, sort_order)
  on public.payment_items to authenticated;
grant delete on public.payment_items to authenticated;

-- payments
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
grant insert (payment_item_id, currency, amount_paid, paid_at,
              method, reference, notes, recorded_by)
  on public.payments to authenticated;
grant update (amount_paid, paid_at, method, reference, notes)
  on public.payments to authenticated;
grant delete on public.payments to authenticated;
