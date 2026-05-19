-- Order alerts via CallMeBot: WhatsApp + Signal (server-side, on new order)
-- Run once in Supabase SQL Editor after orders + app_settings exist.
--
-- WhatsApp: https://www.callmebot.com/blog/free-api-whatsapp-messages/
-- Signal:   https://www.callmebot.com/blog/free-api-signal-messages/
--
-- Admin → Content → configure each channel → Save → Send test message

create extension if not exists pg_net with schema extensions;

-- Hide API keys from public/anon reads
drop policy if exists "app_settings_select_all" on public.app_settings;

drop policy if exists "app_settings_select_public" on public.app_settings;
create policy "app_settings_select_public"
on public.app_settings
for select
to anon, authenticated
using (key not in ('callmebot_apikey', 'callmebot_signal_apikey'));

drop policy if exists "app_settings_select_sensitive_admin" on public.app_settings;
create policy "app_settings_select_sensitive_admin"
on public.app_settings
for select
to authenticated
using (
  key in ('callmebot_apikey', 'callmebot_signal_apikey')
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

insert into public.app_settings (key, value)
values
  ('callmebot_enabled', '0'),
  ('callmebot_phone', ''),
  ('callmebot_apikey', ''),
  ('callmebot_signal_enabled', '0'),
  ('callmebot_signal_phone', ''),
  ('callmebot_signal_apikey', '')
on conflict (key) do nothing;

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

create or replace function public.setting_is_enabled(p_key text)
returns boolean
language sql
stable
as $$
  select trim(public.app_setting(p_key)) in ('1', 'true', 'yes', 'on');
$$;

-- Signal: phone with country code (+49...) or UUID; do not strip to digits only
create or replace function public.format_callmebot_signal_phone(p text)
returns text
language sql
immutable
as $$
  select case
    when trim(coalesce(p, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then trim(p)
    else regexp_replace(trim(coalesce(p, '')), '\s+', '', 'g')
  end;
$$;

create or replace function public.build_order_notify_message(p_order_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o record;
  item_count int;
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

  select count(*)::int
  into item_count
  from public.order_items
  where order_id = p_order_id;

  return
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
end;
$$;

create or replace function public.callmebot_send_whatsapp(p_phone text, p_apikey text, p_text text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  phone text;
  url text;
begin
  phone := regexp_replace(trim(coalesce(p_phone, '')), '[^0-9]', '', 'g');
  if phone = '' or trim(coalesce(p_apikey, '')) = '' or coalesce(p_text, '') = '' then
    return;
  end if;

  url :=
    'https://api.callmebot.com/whatsapp.php?phone=' ||
    public.url_encode_utf8(phone) ||
    '&text=' || public.url_encode_utf8(p_text) ||
    '&apikey=' || public.url_encode_utf8(trim(p_apikey));

  perform net.http_get(url := url);
end;
$$;

create or replace function public.callmebot_send_signal(p_phone text, p_apikey text, p_text text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  phone text;
  url text;
begin
  phone := public.format_callmebot_signal_phone(p_phone);
  if phone = '' or trim(coalesce(p_apikey, '')) = '' or coalesce(p_text, '') = '' then
    return;
  end if;

  url :=
    'https://signal.callmebot.com/signal/send.php?phone=' ||
    public.url_encode_utf8(phone) ||
    '&apikey=' || public.url_encode_utf8(trim(p_apikey)) ||
    '&text=' || public.url_encode_utf8(p_text);

  perform net.http_get(url := url);
end;
$$;

create or replace function public.notify_order_whatsapp(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  msg text;
begin
  msg := public.build_order_notify_message(p_order_id);
  if msg is null then
    return;
  end if;

  if public.setting_is_enabled('callmebot_enabled') then
    begin
      perform public.callmebot_send_whatsapp(
        public.app_setting('callmebot_phone'),
        public.app_setting('callmebot_apikey'),
        msg
      );
    exception
      when others then
        raise notice 'notify whatsapp failed for %: %', p_order_id, sqlerrm;
    end;
  end if;

  if public.setting_is_enabled('callmebot_signal_enabled') then
    begin
      perform public.callmebot_send_signal(
        public.app_setting('callmebot_signal_phone'),
        public.app_setting('callmebot_signal_apikey'),
        msg
      );
    exception
      when others then
        raise notice 'notify signal failed for %: %', p_order_id, sqlerrm;
    end;
  end if;
exception
  when others then
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

create or replace function public.admin_test_order_notify(p_channel text default 'whatsapp')
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  channel text := lower(trim(coalesce(p_channel, 'whatsapp')));
  msg text := 'اختبار BeebBeeb: إشعارات الطلبات تعمل بنجاح.';
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if channel = 'signal' then
    if not public.setting_is_enabled('callmebot_signal_enabled') then
      return 'إشعارات Signal غير مفعّلة. فعّلها واحفظ الإعدادات.';
    end if;
    if trim(public.app_setting('callmebot_signal_phone')) = ''
       or trim(public.app_setting('callmebot_signal_apikey')) = '' then
      return 'أدخل رقم Signal (أو UUID) ومفتاح API ثم احفظ.';
    end if;
    perform public.callmebot_send_signal(
      public.app_setting('callmebot_signal_phone'),
      public.app_setting('callmebot_signal_apikey'),
      msg
    );
    return 'تم إرسال رسالة الاختبار إلى Signal.';
  end if;

  if not public.setting_is_enabled('callmebot_enabled') then
    return 'إشعارات واتساب غير مفعّلة. فعّلها واحفظ الإعدادات.';
  end if;
  if trim(public.app_setting('callmebot_phone')) = ''
     or trim(public.app_setting('callmebot_apikey')) = '' then
    return 'أدخل رقم الواتساب ومفتاح CallMeBot ثم احفظ.';
  end if;
  perform public.callmebot_send_whatsapp(
    public.app_setting('callmebot_phone'),
    public.app_setting('callmebot_apikey'),
    msg
  );
  return 'تم إرسال رسالة الاختبار إلى واتساب.';
exception
  when others then
    return 'فشل الإرسال: ' || sqlerrm;
end;
$$;

-- Backward-compatible alias
create or replace function public.admin_test_order_whatsapp()
returns text
language sql
security definer
set search_path = public
as $$
  select public.admin_test_order_notify('whatsapp');
$$;

grant execute on function public.admin_test_order_notify(text) to authenticated;
grant execute on function public.admin_test_order_whatsapp() to authenticated;
