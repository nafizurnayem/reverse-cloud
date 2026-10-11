-- 0007_content_policies
-- Who can read and write the public content tables (plan section 5.5).
--
-- Visitors (anon) and signed-in users: read published rows only.
-- Staff with content.manage: read and write everything in these tables.
-- Reviews: staff with reviews.moderate. Clients writing their own review
-- comes in Phase 3, when the clients and projects tables exist.
--
-- app.has_permission() can only be called by signed-in users, so every staff
-- policy is limited to "authenticated". Public-read policies cover both.

-- ------------------------------------------------------------- site_settings
create policy "site_settings: public read"
  on public.site_settings for select to anon, authenticated
  using (is_public);

create policy "site_settings: staff manage"
  on public.site_settings for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

-- ------------------------------------------------------------------ services
create policy "services: public read"
  on public.services for select to anon, authenticated
  using (is_published and archived_at is null);

create policy "services: staff manage"
  on public.services for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

-- --------------------------------------------------------------------- faqs
-- A published FAQ is hidden if it belongs to a service that is not public.
create policy "faqs: public read"
  on public.faqs for select to anon, authenticated
  using (
    is_published
    and (
      service_id is null
      or exists (
        select 1 from public.services s
        where s.id = service_id and s.is_published and s.archived_at is null
      )
    )
  );

create policy "faqs: staff manage"
  on public.faqs for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

-- ---------------------------------------------------------------- portfolio
create policy "portfolio_items: public read"
  on public.portfolio_items for select to anon, authenticated
  using (is_published and client_consent);

create policy "portfolio_items: staff manage"
  on public.portfolio_items for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

create policy "portfolio_services: public read"
  on public.portfolio_services for select to anon, authenticated
  using (exists (
    select 1 from public.portfolio_items pi
    where pi.id = portfolio_item_id and pi.is_published and pi.client_consent
  ));

create policy "portfolio_services: staff manage"
  on public.portfolio_services for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

create policy "portfolio_media: public read"
  on public.portfolio_media for select to anon, authenticated
  using (exists (
    select 1 from public.portfolio_items pi
    where pi.id = portfolio_item_id and pi.is_published and pi.client_consent
  ));

create policy "portfolio_media: staff manage"
  on public.portfolio_media for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

-- --------------------------------------------------------------- blog_posts
create policy "blog_posts: public read"
  on public.blog_posts for select to anon, authenticated
  using (status = 'published');

create policy "blog_posts: staff manage"
  on public.blog_posts for all to authenticated
  using      (app.has_permission('content.manage'))
  with check (app.has_permission('content.manage'));

-- ------------------------------------------------------------------ reviews
-- No delete policy on purpose: a bad review is rejected, not deleted.
create policy "reviews: public read approved"
  on public.reviews for select to anon, authenticated
  using (status = 'approved');

create policy "reviews: moderators read all"
  on public.reviews for select to authenticated
  using (app.has_permission('reviews.moderate'));

create policy "reviews: moderators insert"
  on public.reviews for insert to authenticated
  with check (app.has_permission('reviews.moderate'));

create policy "reviews: moderators update"
  on public.reviews for update to authenticated
  using      (app.has_permission('reviews.moderate'))
  with check (app.has_permission('reviews.moderate'));

-- ----------------------------------------------------- storage: public-media
-- Portfolio and blog images. Anyone can view a file if they know its URL
-- (the bucket is public). Only staff with content.manage can upload or change
-- files. The bucket accepts images only, up to 5 MB. SVG is left out on purpose
-- because SVG files can carry scripts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media', 'public-media', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

create policy "public-media: staff read"
  on storage.objects for select to authenticated
  using (bucket_id = 'public-media' and app.has_permission('content.manage'));

create policy "public-media: staff upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and app.has_permission('content.manage'));

create policy "public-media: staff update"
  on storage.objects for update to authenticated
  using      (bucket_id = 'public-media' and app.has_permission('content.manage'))
  with check (bucket_id = 'public-media' and app.has_permission('content.manage'));

create policy "public-media: staff delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and app.has_permission('content.manage'));