-- Supabase Storage setup for product images
-- 1) Create a bucket named: product-images (public recommended for simple storefront)
-- 2) Then run these policies so ONLY admins can upload/update/delete.
--
-- Notes:
-- - If you make the bucket PUBLIC, anyone can read images via URL.
-- - If bucket is PRIVATE, you must generate signed URLs instead of getPublicUrl().

-- Enable RLS on storage objects (usually already enabled)
alter table if exists storage.objects enable row level security;

-- Helper: admin check via profiles.is_admin
-- (Used inside policies)

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

-- If bucket is PRIVATE and you still want listing from admin UI:
drop policy if exists "product_images_admin_select" on storage.objects;
create policy "product_images_admin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

