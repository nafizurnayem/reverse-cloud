-- 0023_private_invoices_bucket
-- Private storage bucket and storage RLS policies for invoices (plan section 3.5).
--
-- SECURITY MODEL:
-- - The bucket is private (public = false).
-- - Staff with payments.read or payments.manage can read all invoice files.
-- - Staff with payments.manage can upload, update, and delete invoice files.
-- - Clients can only read (download) invoice objects within paths belonging to:
--     1. Their own client_id: "<client_id>/<file>.pdf"
--     2. Their own active/completed project_id: "<project_id>/<file>.pdf"
-- - Clients can NEVER upload, update, or delete files in the invoices bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoices',
  'invoices',
  false,
  10485760, -- 10 MB limit
  array['application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf'];

-- ------------------------------------------------------------- storage policies

-- 1. Staff with payments.read or payments.manage can read all invoices
create policy "invoices: staff read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'invoices'
    and (
      app.has_permission('payments.read')
      or app.has_permission('payments.manage')
    )
  );

-- 2. Staff with payments.manage can upload invoices
create policy "invoices: staff upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and app.has_permission('payments.manage')
  );

-- 3. Staff with payments.manage can update invoice objects
create policy "invoices: staff update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'invoices'
    and app.has_permission('payments.manage')
  )
  with check (
    bucket_id = 'invoices'
    and app.has_permission('payments.manage')
  );

-- 4. Staff with payments.manage can delete invoice objects
create policy "invoices: staff delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'invoices'
    and app.has_permission('payments.manage')
  );

-- 5. Clients can read only their own invoices (scoped by client_id or project_id)
create policy "invoices: client read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'invoices'
    and app.my_client_id() is not null
    and (
      split_part(name, '/', 1) = app.my_client_id()::text
      or exists (
        select 1 from public.projects p
         where p.id::text = split_part(name, '/', 1)
           and p.client_id = app.my_client_id()
           and p.status in ('active', 'on_hold', 'completed')
      )
    )
  );
