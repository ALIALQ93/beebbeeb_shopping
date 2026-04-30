-- Shipping rates per governorate/city (IQD)
-- Run once in Supabase SQL Editor.

create table if not exists public.shipping_rates (
  city text primary key,
  fee_iqd int not null check (fee_iqd >= 0),
  updated_at timestamptz not null default now()
);

alter table public.shipping_rates enable row level security;

-- Anyone can read shipping rates (customers need it at checkout)
drop policy if exists "shipping_rates_select_all" on public.shipping_rates;
create policy "shipping_rates_select_all"
on public.shipping_rates
for select
to anon, authenticated
using (true);

-- Only admins can insert/update/delete
drop policy if exists "shipping_rates_admin_write" on public.shipping_rates;
create policy "shipping_rates_admin_write"
on public.shipping_rates
for all
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

-- Seed defaults (edit from admin UI anytime)
insert into public.shipping_rates(city, fee_iqd)
values
  ('بغداد', 5000),
  ('البصرة', 7000),
  ('نينوى', 7000),
  ('أربيل', 7000),
  ('السليمانية', 7000),
  ('دهوك', 7000),
  ('كربلاء', 6000),
  ('النجف', 6000),
  ('ذي قار', 7000),
  ('ميسان', 7000),
  ('واسط', 6000),
  ('ديالى', 6000),
  ('بابل', 6000),
  ('المثنى', 7000),
  ('القادسية', 7000),
  ('صلاح الدين', 7000),
  ('كركوك', 7000),
  ('الأنبار', 7000)
on conflict (city) do nothing;

