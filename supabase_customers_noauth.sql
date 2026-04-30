-- Custom customer accounts WITHOUT Supabase Auth (admin can still use Supabase Auth).
-- This creates: customers + sessions + RPCs for signup/login + order RPCs.
--
-- IMPORTANT SECURITY NOTE:
-- This approach relies on SECURITY DEFINER functions and a session token stored in DB.
-- It's simpler for your use-case (phone/password without email), but Supabase Auth is still more secure/standard.

-- Supabase عادة يضع الإضافات في schema: extensions
create extension if not exists pgcrypto with schema extensions;

-- 1) Customers table
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;

-- Nobody reads/writes customers directly from client (only via RPC).
drop policy if exists "customers_block_all" on public.customers;
create policy "customers_block_all"
on public.customers
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

-- 2) Sessions table
create table if not exists public.customer_sessions (
  token uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists customer_sessions_customer_id_idx on public.customer_sessions(customer_id);

alter table public.customer_sessions enable row level security;

drop policy if exists "customer_sessions_block_all" on public.customer_sessions;
create policy "customer_sessions_block_all"
on public.customer_sessions
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

-- 3) Helpers
create or replace function public.norm_phone(v text)
returns text
language plpgsql
immutable
as $$
declare
  x text;
begin
  x := regexp_replace(coalesce(v,''), '\s+', '', 'g');
  if x = '' then return ''; end if;
  if left(x,1) = '+' then return x; end if;
  if left(x,2) = '00' then return '+' || substr(x,3); end if;
  if left(x,1) = '0' then return '+964' || substr(x,2); end if;
  if left(x,3) = '964' then return '+' || x; end if;
  return x;
end;
$$;

create or replace function public.is_valid_phone(v text)
returns boolean
language sql
immutable
as $$
  select public.norm_phone(v) ~ '^\+9647\d{9}$';
$$;

-- 4) Signup: returns session token
create or replace function public.customer_signup(p_full_name text, p_phone text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ph text;
  cid uuid;
  tok uuid;
begin
  ph := public.norm_phone(p_phone);
  if coalesce(trim(p_full_name),'') = '' then
    raise exception 'missing full_name';
  end if;
  if not public.is_valid_phone(ph) then
    raise exception 'invalid phone';
  end if;
  if coalesce(p_password,'') = '' or length(p_password) < 6 then
    raise exception 'weak password';
  end if;

  insert into public.customers(full_name, phone, password_hash)
  values (trim(p_full_name), ph, extensions.crypt(p_password, extensions.gen_salt('bf')))
  returning id into cid;

  insert into public.customer_sessions(customer_id)
  values (cid)
  returning token into tok;

  return tok;
exception
  when unique_violation then
    raise exception 'phone already exists';
end;
$$;

grant execute on function public.customer_signup(text, text, text) to anon, authenticated;

-- 5) Login: returns new session token
create or replace function public.customer_login(p_phone text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ph text;
  cid uuid;
  hash text;
  tok uuid;
begin
  ph := public.norm_phone(p_phone);
  select id, password_hash into cid, hash
  from public.customers
  where phone = ph;

  if cid is null then
    raise exception 'invalid credentials';
  end if;
  if extensions.crypt(coalesce(p_password,''), hash) <> hash then
    raise exception 'invalid credentials';
  end if;

  insert into public.customer_sessions(customer_id)
  values (cid)
  returning token into tok;
  return tok;
end;
$$;

grant execute on function public.customer_login(text, text) to anon, authenticated;

-- 6) Validate token + return customer
create or replace function public.customer_me(p_token uuid)
returns table(customer_id uuid, full_name text, phone text)
language sql
security definer
set search_path = public
as $$
  select c.id, c.full_name, c.phone
  from public.customer_sessions s
  join public.customers c on c.id = s.customer_id
  where s.token = p_token
    and s.expires_at > now()
  limit 1;
$$;

grant execute on function public.customer_me(uuid) to anon, authenticated;

-- 7) Orders linkage (customer_id)
alter table public.orders
add column if not exists customer_id uuid null references public.customers(id) on delete set null;

-- 8) Customer creates order via RPC (inserts order + items + applies inventory)
-- cart_items: [{product_id, qty, unit_price_iqd, color, age_range}]
create or replace function public.customer_create_order(
  p_token uuid,
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_city text,
  p_shipping_address text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me record;
  oid uuid;
  it jsonb;
  total_amount numeric := 0;
  oi record;
  cur int;
  ship_fee int := 0;
begin
  select * into me from public.customer_me(p_token) limit 1;
  if me.customer_id is null then
    raise exception 'not logged in';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid items';
  end if;

  -- Create order
  insert into public.orders(customer_id, user_id, status, total, currency, shipping_name, shipping_phone, shipping_city, shipping_address)
  values (me.customer_id, me.customer_id, 'pending', 0, 'IQD', p_shipping_name, public.norm_phone(p_shipping_phone), p_shipping_city, p_shipping_address)
  returning id into oid;

  -- Items
  for it in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items(order_id, product_id, qty, unit_price_iqd, color, age_range)
    values (
      oid,
      (it->>'product_id')::uuid,
      greatest(1, (it->>'qty')::int),
      greatest(0, (it->>'unit_price_iqd')::numeric),
      nullif(it->>'color',''),
      nullif(it->>'age_range','')
    );
    total_amount := total_amount + greatest(1, (it->>'qty')::int) * greatest(0, (it->>'unit_price_iqd')::numeric);
  end loop;

  -- Shipping fee from shipping_rates (fallback 5000)
  select coalesce((select fee_iqd from public.shipping_rates where city = p_shipping_city limit 1), 5000)
  into ship_fee;

  update public.orders
  set shipping_fee_iqd = greatest(0, coalesce(ship_fee, 0)),
      total = total_amount + greatest(0, coalesce(ship_fee, 0))
  where id = oid;

  -- Apply inventory (variant based) - inlined (no Supabase Auth for customers)
  perform 1 from public.orders o where o.id = oid for update;

  for oi in
    select product_id, color, age_range, qty
    from public.order_items
    where order_id = oid
  loop
    if oi.color is null or length(oi.color) = 0 or oi.age_range is null or length(oi.age_range) = 0 then
      raise exception 'missing variant for order item';
    end if;

    select stock into cur
    from public.product_variant_stock
    where product_id = oi.product_id and color = oi.color and age_range = oi.age_range
    for update;

    if cur is null then
      raise exception 'no stock row for variant';
    end if;

    if cur < oi.qty then
      raise exception 'insufficient stock for variant';
    end if;

    update public.product_variant_stock
    set stock = stock - oi.qty, updated_at = now()
    where product_id = oi.product_id and color = oi.color and age_range = oi.age_range;

    perform public.recalc_product_stock(oi.product_id);
  end loop;

  update public.orders
  set inventory_applied = true, confirmed_at = coalesce(confirmed_at, now()), status = coalesce(status,'pending')
  where id = oid;

  return oid;
end;
$$;

grant execute on function public.customer_create_order(uuid, text, text, text, text, jsonb) to anon, authenticated;

-- 9) Customer list own orders
create or replace function public.customer_list_orders(p_token uuid)
returns table(id uuid, status text, total numeric, currency text, shipping_name text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select o.id, o.status, o.total, o.currency, o.shipping_name, o.created_at
  from public.orders o
  join public.customer_sessions s on s.customer_id = o.customer_id
  where s.token = p_token
    and s.expires_at > now()
  order by o.created_at desc
  limit 200;
$$;

grant execute on function public.customer_list_orders(uuid) to anon, authenticated;

-- 10) Customer get order details for tracking page
create or replace function public.customer_get_order(p_token uuid, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me record;
  o record;
  items jsonb;
begin
  select * into me from public.customer_me(p_token) limit 1;
  if me.customer_id is null then
    raise exception 'not logged in';
  end if;

  select id, status, total, currency, shipping_name, shipping_phone, shipping_city, shipping_address, created_at
  into o
  from public.orders
  where id = p_order_id and customer_id = me.customer_id
  limit 1;

  if o.id is null then
    return jsonb_build_object('order', null, 'items', jsonb_build_array());
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', oi.product_id,
        'title', p.title,
        'color', oi.color,
        'age_range', oi.age_range,
        'qty', oi.qty,
        'unit_price_iqd', oi.unit_price_iqd
      )
      order by oi.created_at asc
    ),
    jsonb_build_array()
  )
  into items
  from public.order_items oi
  left join public.products p on p.id = oi.product_id
  where oi.order_id = p_order_id;

  return jsonb_build_object(
    'order',
    jsonb_build_object(
      'id', o.id,
      'status', o.status,
      'total', o.total,
      'currency', o.currency,
      'shipping_name', o.shipping_name,
      'shipping_phone', o.shipping_phone,
      'shipping_city', o.shipping_city,
      'shipping_address', o.shipping_address,
      'created_at', o.created_at
    ),
    'items',
    items
  );
end;
$$;

grant execute on function public.customer_get_order(uuid, uuid) to anon, authenticated;

