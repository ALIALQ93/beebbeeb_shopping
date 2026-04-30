-- Inventory automation: adjust stock by color + apply/revert order inventory
-- Run in Supabase SQL Editor after creating:
-- - public.product_color_stock
-- - public.products
-- - public.orders
-- - public.order_items
--
-- Requires order_items to have column: color (text)

-- 1) Add columns to orders for inventory state (idempotent)
do $$
begin
  if to_regclass('public.orders') is not null then
    execute 'alter table public.orders add column if not exists inventory_applied boolean not null default false';
    execute 'alter table public.orders add column if not exists cancelled_at timestamptz';
    execute 'alter table public.orders add column if not exists confirmed_at timestamptz';
  end if;
end $$;

-- 2) Ensure order_items has color column
do $$
begin
  if to_regclass('public.order_items') is not null then
    execute 'alter table public.order_items add column if not exists color text';
  end if;
end $$;

-- 3) Helper: recalc products.stock from per-color rows
create or replace function public.recalc_product_stock(p_product_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products p
  set stock = coalesce((
    select sum(s.stock)::int from public.product_color_stock s where s.product_id = p_product_id
  ), 0)
  where p.id = p_product_id;
$$;

-- 4) Admin-only adjustment: add/subtract delta to a color
create or replace function public.adjust_color_stock(p_product_id uuid, p_color text, p_delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin check
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'not allowed';
  end if;

  insert into public.product_color_stock (product_id, color, stock, updated_at)
  values (p_product_id, p_color, greatest(0, coalesce(p_delta,0)), now())
  on conflict (product_id, color)
  do update set stock = greatest(0, public.product_color_stock.stock + coalesce(p_delta,0)), updated_at = now();

  perform public.recalc_product_stock(p_product_id);
end;
$$;

grant execute on function public.adjust_color_stock(uuid, text, int) to authenticated;
grant execute on function public.recalc_product_stock(uuid) to authenticated;

-- Wrapper for clients that resolve args in a different order in schema cache.
-- Some PostgREST schema-cache lookups can appear as: adjust_color_stock(p_color, p_delta, p_product_id)
create or replace function public.adjust_color_stock(p_color text, p_delta int, p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.adjust_color_stock(p_product_id, p_color, p_delta);
end;
$$;

grant execute on function public.adjust_color_stock(text, int, uuid) to authenticated;

-- 5) Apply inventory for order: subtract per item color qty once
create or replace function public.apply_order_inventory(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  oi record;
  cur int;
begin
  -- only authenticated
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- lock order row
  perform 1 from public.orders o where o.id = p_order_id for update;

  if (select inventory_applied from public.orders where id = p_order_id) then
    return;
  end if;

  for oi in
    select product_id, color, qty
    from public.order_items
    where order_id = p_order_id
  loop
    if oi.color is null or length(oi.color) = 0 then
      raise exception 'missing color for order item';
    end if;

    select stock into cur
    from public.product_color_stock
    where product_id = oi.product_id and color = oi.color
    for update;

    if cur is null then
      raise exception 'no stock row for color %', oi.color;
    end if;

    if cur < oi.qty then
      raise exception 'insufficient stock for %', oi.color;
    end if;

    update public.product_color_stock
    set stock = stock - oi.qty, updated_at = now()
    where product_id = oi.product_id and color = oi.color;

    perform public.recalc_product_stock(oi.product_id);
  end loop;

  update public.orders
  set inventory_applied = true, confirmed_at = coalesce(confirmed_at, now()), status = coalesce(status,'pending')
  where id = p_order_id;
end;
$$;

grant execute on function public.apply_order_inventory(uuid) to authenticated;

-- 6) Revert inventory for order (on cancel): add back qty once
create or replace function public.revert_order_inventory(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  oi record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  perform 1 from public.orders o where o.id = p_order_id for update;

  if not (select inventory_applied from public.orders where id = p_order_id) then
    return;
  end if;

  for oi in
    select product_id, color, qty
    from public.order_items
    where order_id = p_order_id
  loop
    if oi.color is null or length(oi.color) = 0 then
      continue;
    end if;

    insert into public.product_color_stock (product_id, color, stock, updated_at)
    values (oi.product_id, oi.color, greatest(0, oi.qty), now())
    on conflict (product_id, color)
    do update set stock = public.product_color_stock.stock + oi.qty, updated_at = now();

    perform public.recalc_product_stock(oi.product_id);
  end loop;

  update public.orders
  set inventory_applied = false, cancelled_at = coalesce(cancelled_at, now()), status = 'cancelled'
  where id = p_order_id;
end;
$$;

grant execute on function public.revert_order_inventory(uuid) to authenticated;

