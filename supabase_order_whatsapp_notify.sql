-- WhatsApp order alerts via CallMeBot (server-side, triggered when order inventory is applied)
-- Run once in Supabase SQL Editor after orders + app_settings exist.
--
-- Setup:
-- 1) On WhatsApp, message CallMeBot bot to get your API key (see https://www.callmebot.com/blog/free-api-whatsapp-messages/)
-- 2) Run this file
-- 3) Admin → Content → "Order WhatsApp alerts" → enable + phone + API key → Save
-- 4) Optional: click "Send test message"

create extension if not exists pg_net with schema extensions;

-- Hide CallMeBot API key from public/anon reads (other settings stay readable)
drop policy if exists "app_settings_select_all" on public.app_settings;

drop policy if exists "app_settings_select_public" on public.app_settings;
create policy "app_settings_select_public"
on public.app_settings
for select
to anon, authenticated
using (key not in ('callmebot_apikey'));

drop policy if exists "app_settings_select_sensitive_admin" on public.app_settings;
create policy "app_settings_select_sensitive_admin"
on public.app_settings
for select
to authenticated
using (
  key in ('callmebot_apikey')
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

insert into public.app_settings (key, value)
values
  ('callmebot_enabled', '0'),
  ('callmebot_phone', ''),
  ('callmebot_apikey', '')
on conflict (key) do nothing;

-- UTF-8 percent-encoding for CallMeBot query string
create or replace function public.url_encode_utf8(p text)
returns text
language plpgsql
immutable
as $$
declare
  raw bytea := convert_to(coalesce(p, ''), 'UTF8');
  result text := '';
  i int;
  b int;
  c text;
begin
  if length(raw) = 0 then
    return '';
  end if;

  for i in 0..(length(raw) - 1) loop
    b := get_byte(raw, i);
    c := chr(b);
    if c ~ '^[A-Za-z0-9._~-]$' then
      result := result || c;
    else
      result := result || '%' || upper(lpad(to_hex(b), 2, '0'));
    end if;
  end loop;
  return result;
end;
$$;

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

create or replace function public.notify_order_whatsapp(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  o record;
  item_count int;
  msg text;
  phone text;
  apikey text;
  enabled text;
  url text;
begin
  enabled := trim(public.app_setting('callmebot_enabled'));
  if enabled not in ('1', 'true', 'yes', 'on') then
    return;
  end if;

  phone := regexp_replace(trim(public.app_setting('callmebot_phone')), '[^0-9]', '', 'g');
  apikey := trim(public.app_setting('callmebot_apikey'));
  if phone = '' or apikey = '' then
    return;
  end if;

  select
    id,
    status,
    total,
    currency,
    shipping_name,
    shipping_phone,
    shipping_city,
    shipping_address,
    shipping_fee_iqd,
    created_at
  into o
  from public.orders
  where id = p_order_id;

  if o.id is null then
    return;
  end if;

  select count(*)::int
  into item_count
  from public.order_items
  where order_id = p_order_id;

  msg :=
    'طلب جديد - BeebBeeb' || E'\n' ||
    'رقم: ' || left(o.id::text, 8) || E'\n' ||
    'الحالة: ' || coalesce(o.status, 'pending') || E'\n' ||
    'الاسم: ' || coalesce(o.shipping_name, '-') || E'\n' ||
    'هاتف: ' || coalesce(o.shipping_phone, '-') || E'\n' ||
    'المدينة: ' || coalesce(o.shipping_city, '-') || E'\n' ||
    'العنوان: ' || coalesce(o.shipping_address, '-') || E'\n' ||
    'المنتجات: ' || item_count::text || E'\n' ||
    'التوصيل: ' || coalesce(o.shipping_fee_iqd, 0)::text || ' IQD' || E'\n' ||
    'المجموع: ' || coalesce(o.total, 0)::text || ' ' || coalesce(o.currency, 'IQD');

  url :=
    'https://api.callmebot.com/whatsapp.php?phone=' ||
    public.url_encode_utf8(phone) ||
    '&text=' || public.url_encode_utf8(msg) ||
    '&apikey=' || public.url_encode_utf8(apikey);

  perform net.http_get(url := url);
exception
  when others then
    -- Never block checkout if notification fails
    raise notice 'notify_order_whatsapp failed for %: %', p_order_id, sqlerrm;
end;
$$;

create or replace function public.trg_orders_whatsapp_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.inventory_applied is true
     and (TG_OP = 'INSERT' or coalesce(OLD.inventory_applied, false) is not true)
  then
    perform public.notify_order_whatsapp(NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists orders_whatsapp_notify on public.orders;
create trigger orders_whatsapp_notify
after insert or update on public.orders
for each row
execute function public.trg_orders_whatsapp_notify();

-- Admin: send a test WhatsApp (does not create an order)
create or replace function public.admin_test_order_whatsapp()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  phone text;
  apikey text;
  enabled text;
  msg text;
  url text;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  enabled := trim(public.app_setting('callmebot_enabled'));
  if enabled not in ('1', 'true', 'yes', 'on') then
    return 'التنبيهات غير مفعّلة. فعّلها واحفظ الإعدادات.';
  end if;

  phone := regexp_replace(trim(public.app_setting('callmebot_phone')), '[^0-9]', '', 'g');
  apikey := trim(public.app_setting('callmebot_apikey'));
  if phone = '' or apikey = '' then
    return 'أدخل رقم الواتساب ومفتاح CallMeBot ثم احفظ.';
  end if;

  msg := 'اختبار BeebBeeb: إشعارات الطلبات تعمل بنجاح.';

  url :=
    'https://api.callmebot.com/whatsapp.php?phone=' ||
    public.url_encode_utf8(phone) ||
    '&text=' || public.url_encode_utf8(msg) ||
    '&apikey=' || public.url_encode_utf8(apikey);

  perform net.http_get(url := url);
  return 'تم إرسال رسالة الاختبار إلى واتساب.';
exception
  when others then
    return 'فشل الإرسال: ' || sqlerrm;
end;
$$;

grant execute on function public.admin_test_order_whatsapp() to authenticated;
