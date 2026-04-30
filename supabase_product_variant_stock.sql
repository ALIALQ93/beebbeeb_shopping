-- Variant stock quantities for products (color + age_range)
-- Run in Supabase SQL Editor.

create table if not exists public.product_variant_stock (
  id bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  color text not null,
  age_range text not null,
  stock int not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id, color, age_range)
);

alter table public.product_variant_stock enable row level security;

-- Admin only (profiles.is_admin) can manage/read this table.
drop policy if exists "product_variant_stock_select_admin" on public.product_variant_stock;
create policy "product_variant_stock_select_admin"
on public.product_variant_stock
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "product_variant_stock_insert_admin" on public.product_variant_stock;
create policy "product_variant_stock_insert_admin"
on public.product_variant_stock
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "product_variant_stock_update_admin" on public.product_variant_stock;
create policy "product_variant_stock_update_admin"
on public.product_variant_stock
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "product_variant_stock_delete_admin" on public.product_variant_stock;
create policy "product_variant_stock_delete_admin"
on public.product_variant_stock
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

