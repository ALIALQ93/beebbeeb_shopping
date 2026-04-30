-- Discounts + stock safety fields for products
-- Run in Supabase SQL Editor once.

alter table public.products
add column if not exists discount_percent int not null default 0;

-- Optional: prevent invalid discount values
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_discount_percent_range'
  ) then
    alter table public.products
      add constraint products_discount_percent_range
      check (discount_percent >= 0 and discount_percent <= 90);
  end if;
end $$;

