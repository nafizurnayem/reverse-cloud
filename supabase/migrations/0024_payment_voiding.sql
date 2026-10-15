-- 0024_payment_voiding
-- Adds an auditable payment void operation. Voided receipts remain visible to
-- staff, are hidden from clients, and no longer count toward installment totals.

alter table public.payments
  add column voided_at timestamptz,
  add column voided_by uuid references auth.users (id) on delete set null,
  add column void_reason text check (
    void_reason is null or char_length(btrim(void_reason)) between 1 and 500
  ),
  add constraint payments_void_fields_consistent check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and void_reason is not null)
  );

create or replace function app.recalc_payment_item_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_id     uuid;
  v_amount_due  numeric;
  v_item_status text;
  v_total_paid  numeric;
begin
  v_item_id := coalesce(new.payment_item_id, old.payment_item_id);

  select pi.amount_due, pi.status
    into v_amount_due, v_item_status
    from public.payment_items pi
   where pi.id = v_item_id;

  if not found or v_item_status = 'cancelled' then
    return null;
  end if;

  select coalesce(sum(p.amount_paid), 0)
    into v_total_paid
    from public.payments p
   where p.payment_item_id = v_item_id
     and p.voided_at is null;

  if v_total_paid >= v_amount_due then
    update public.payment_items
       set status = 'paid',
           paid_at = coalesce(paid_at, now())
     where id = v_item_id
       and status <> 'paid';
  else
    update public.payment_items
       set status = 'pending',
           paid_at = null
     where id = v_item_id
       and status = 'paid';
  end if;

  return null;
end;
$$;

create function public.void_payment(p_payment_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_reason text;
begin
  if (select auth.uid()) is null or not app.has_permission('payments.manage') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  v_reason := nullif(btrim(p_reason), '');
  if v_reason is null or char_length(v_reason) > 500 then
    raise exception 'invalid_void_reason' using errcode = '22023';
  end if;

  select * into v_payment
    from public.payments
   where id = p_payment_id
   for update;

  if not found or v_payment.voided_at is not null then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;

  update public.payments
     set voided_at = now(),
         voided_by = (select auth.uid()),
         void_reason = v_reason
   where id = p_payment_id;

  return p_payment_id;
end;
$$;

revoke all on function public.void_payment(uuid, text) from public, anon;
grant execute on function public.void_payment(uuid, text) to authenticated;

drop policy "payments: client read own" on public.payments;
create policy "payments: client read own"
  on public.payments for select to authenticated
  using (
    voided_at is null
    and exists (
      select 1
        from public.payment_items pi
        join public.projects p on p.id = pi.project_id
       where pi.id = payments.payment_item_id
         and p.client_id = app.my_client_id()
         and p.status in ('active', 'on_hold', 'completed')
    )
  );
