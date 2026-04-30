-- Orders + order_items schema (with RLS) for BeebBeeb
-- Run this BEFORE supabase_inventory_orders.sql if you don't have orders tables yet.

-- Ensure uuid generator exists (Supabase typically has pgcrypto)
create extension if not exists pgcrypto;

-- 1) Orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pending',
  total numeric not null default 0,
  currency text not null default 'IQD',
  shipping_name text,
  shipping_phone text,
  shipping_city text,
  shipping_address text,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

-- 2) Order items table
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  color text,
  qty int not null check (qty > 0),
  unit_price_iqd numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);

-- 3) RLS
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Helper: admin check
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- Orders policies
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin" on public.orders
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Order items policies
drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "order_items_insert_own" on public.order_items;
create policy "order_items_insert_own" on public.order_items
for insert to authenticated
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

drop policy if exists "order_items_update_admin" on public.order_items;
create policy "order_items_update_admin" on public.order_items
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "order_items_delete_admin" on public.order_items;
create policy "order_items_delete_admin" on public.order_items
for delete to authenticated
using (public.is_admin());

