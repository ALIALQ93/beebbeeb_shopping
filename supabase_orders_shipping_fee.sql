-- Add shipping fee column to orders (IQD)
-- Run once in Supabase SQL Editor.

do $$
begin
  if to_regclass('public.orders') is not null then
    execute 'alter table public.orders add column if not exists shipping_fee_iqd int not null default 0';
  end if;
end $$;

