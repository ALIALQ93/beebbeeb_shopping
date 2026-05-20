-- Order WhatsApp alerts via GREEN-API (console.green-api.com)
-- Run / re-run in Supabase SQL Editor after orders + app_settings exist.
--
-- Setup: Admin → Content → GREEN-API → paste apiUrl, idInstance, apiTokenInstance, notify phone → Save → Test

create extension if not exists pg_net with schema extensions;

-- Hide tokens from public/anon reads
drop policy if exists "app_settings_select_all" on public.app_settings;

drop policy if exists "app_settings_select_public" on public.app_settings;
create policy "app_settings_select_public"
on public.app_settings
for select
to anon, authenticated
using (
  key not in (
    'greenapi_api_token',
    'callmebot_apikey',
    'callmebot_signal_apikey'
  )
);

drop policy if exists "app_settings_select_sensitive_admin" on public.app_settings;
create policy "app_settings_select_sensitive_admin"
on public.app_settings
for select
to authenticated
using (
  key in (
    'greenapi_api_token',
    'callmebot_apikey',
    'callmebot_signal_apikey'
  )
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

insert into public.app_settings (key, value)
values
  ('greenapi_enabled', '0'),
  ('greenapi_url', 'https://7107.api.greenapi.com'),
  ('greenapi_instance_id', ''),
  ('greenapi_api_token', ''),
  ('greenapi_notify_phone', '')
on conflict (key) do nothing;

create or replace function public.app_setting(p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.value from public.app_settings s where s.key = p_key limit 1),
    ''
  );
$$;

create or replace function public.setting_is_enabled(p_key text)
returns boolean
language sql
stable
as $$
  select trim(public.app_setting(p_key)) in ('1', 'true', 'yes', 'on');
$$;

-- WhatsApp chatId: digits only + @c.us (e.g. 9647777010004@c.us)
create or replace function public.greenapi_chat_id(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(trim(coalesce(p_phone, '')), '[^0-9]', '', 'g'), '') || '@c.us';
$$;

-- Ensure shipping column exists (idempotent)
do $$
begin
  if to_regclass('public.orders') is not null then
    execute 'alter table public.orders add column if not exists shipping_fee_iqd int not null default 0';
  end if;
end $$;

create or replace function public.format_iqd_amount(p_amount numeric)
returns text
language sql
immutable
as $$
  select to_char(round(coalesce(p_amount, 0)), 'FM999,999,999');
$$;

create or replace function public.build_order_notify_message(
  p_order_id uuid,
  p_total numeric default null,
  p_shipping_fee_iqd numeric default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o record;
  item_count int;
  subtotal numeric := 0;
  ship numeric := 0;
  grand numeric := 0;
begin
  select
    id,
    status,
    total,
    currency,
    shipping_name,
    shipping_phone,
    shipping_city,
    shipping_address,
    shipping_fee_iqd
  into o
  from public.orders
  where id = p_order_id;

  if o.id is null then
    return null;
  end if;

  select
    count(*)::int,
    coalesce(sum(greatest(1, oi.qty) * greatest(0, oi.unit_price_iqd)), 0)
  into item_count, subtotal
  from public.order_items oi
  where oi.order_id = p_order_id;

  ship := coalesce(p_shipping_fee_iqd, o.shipping_fee_iqd, 0)::numeric;
  grand := coalesce(nullif(p_total, 0), nullif(o.total, 0), subtotal + ship);

  if ship <= 0 and grand > subtotal then
    ship := grand - subtotal;
  elsif grand < subtotal + ship then
    grand := subtotal + ship;
  end if;

  return
    'طلب جديد - BeebBeeb' || E'\n' ||
    'رقم: ' || left(o.id::text, 8) || E'\n' ||
    'الحالة: ' || coalesce(o.status, 'pending') || E'\n' ||
    'الاسم: ' || coalesce(o.shipping_name, '-') || E'\n' ||
    'هاتف: ' || coalesce(o.shipping_phone, '-') || E'\n' ||
    'المدينة: ' || coalesce(o.shipping_city, '-') || E'\n' ||
    'العنوان: ' || coalesce(o.shipping_address, '-') || E'\n' ||
    'عدد المنتجات: ' || item_count::text || E'\n' ||
    'مجموع المنتجات: ' || public.format_iqd_amount(subtotal) || ' IQD' || E'\n' ||
    'أجور التوصيل: ' || public.format_iqd_amount(ship) || ' IQD' || E'\n' ||
    'الإجمالي: ' || public.format_iqd_amount(grand) || ' ' || coalesce(o.currency, 'IQD');
end;
$$;

create or replace function public.greenapi_send_message(p_chat_id text, p_message text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  instance_id text;
  api_token text;
  url text;
  body jsonb;
begin
  base_url := rtrim(trim(public.app_setting('greenapi_url')), '/');
  instance_id := trim(public.app_setting('greenapi_instance_id'));
  api_token := trim(public.app_setting('greenapi_api_token'));

  if base_url = '' or instance_id = '' or api_token = '' then
    return;
  end if;
  if coalesce(p_chat_id, '') = '' or coalesce(p_message, '') = '' then
    return;
  end if;

  url := base_url || '/waInstance' || instance_id || '/sendMessage/' || api_token;
  body := jsonb_build_object('chatId', p_chat_id, 'message', p_message);

  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := body
  );
end;
$$;

create or replace function public.notify_order_whatsapp(
  p_order_id uuid,
  p_total numeric default null,
  p_shipping_fee_iqd numeric default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  msg text;
  chat_id text;
begin
  if not public.setting_is_enabled('greenapi_enabled') then
    return;
  end if;

  msg := public.build_order_notify_message(p_order_id, p_total, p_shipping_fee_iqd);
  if msg is null then
    return;
  end if;

  chat_id := public.greenapi_chat_id(public.app_setting('greenapi_notify_phone'));
  if chat_id is null then
    return;
  end if;

  begin
    perform public.greenapi_send_message(chat_id, msg);
  exception
    when others then
      raise notice 'greenapi notify failed for %: %', p_order_id, sqlerrm;
  end;
end;
$$;

-- Remove old trigger (was firing before totals were reliable)
drop trigger if exists orders_whatsapp_notify on public.orders;
drop function if exists public.trg_orders_whatsapp_notify();

-- Notification is sent from customer_create_order() after totals are saved.
-- Also re-run supabase_customers_noauth.sql (customer_create_order) once after this file.

create or replace function public.admin_test_order_notify(p_channel text default 'greenapi')
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  channel text := lower(trim(coalesce(p_channel, 'greenapi')));
  msg text := 'اختبار BeebBeeb: إشعارات الطلبات عبر GREEN-API تعمل بنجاح.';
  chat_id text;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if channel not in ('greenapi', 'whatsapp') then
    return 'قناة غير معروفة. استخدم greenapi.';
  end if;

  if not public.setting_is_enabled('greenapi_enabled') then
    return 'إشعارات GREEN-API غير مفعّلة. فعّلها واحفظ الإعدادات.';
  end if;

  if trim(public.app_setting('greenapi_url')) = ''
     or trim(public.app_setting('greenapi_instance_id')) = ''
     or trim(public.app_setting('greenapi_api_token')) = '' then
    return 'أدخل apiUrl و idInstance و apiTokenInstance من console.green-api.com ثم احفظ.';
  end if;

  chat_id := public.greenapi_chat_id(public.app_setting('greenapi_notify_phone'));
  if chat_id is null then
    return 'أدخل رقم واتساب المستلم (مع رمز الدولة، مثل 9647777010004).';
  end if;

  perform public.greenapi_send_message(chat_id, msg);
  return 'تم إرسال رسالة الاختبار عبر GREEN-API إلى ' || chat_id;
exception
  when others then
    return 'فشل الإرسال: ' || sqlerrm;
end;
$$;

create or replace function public.admin_test_order_whatsapp()
returns text
language sql
security definer
set search_path = public
as $$
  select public.admin_test_order_notify('greenapi');
$$;

grant execute on function public.admin_test_order_notify(text) to authenticated;
grant execute on function public.admin_test_order_whatsapp() to authenticated;
