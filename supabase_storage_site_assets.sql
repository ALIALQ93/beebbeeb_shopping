-- Storage policies for bucket: site-assets
-- 1) Create a PUBLIC bucket named: site-assets (Storage -> Buckets)
-- 2) Then run this in Supabase SQL Editor.
--
-- This allows:
-- - anyone to read objects from this bucket
-- - only admins to upload/update/delete objects
--
-- Note: Do NOT run ALTER TABLE storage.objects (not allowed).

-- Anyone can read (public)
drop policy if exists "site_assets_read_public" on storage.objects;
create policy "site_assets_read_public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'site-assets');

-- Admin-only write
drop policy if exists "site_assets_write_admin" on storage.objects;
create policy "site_assets_write_admin"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'site-assets'
  and public.is_admin()
)
with check (
  bucket_id = 'site-assets'
  and public.is_admin()
);

