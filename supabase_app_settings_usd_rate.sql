-- App settings: USD/IQD exchange rate
-- Run once in Supabase SQL Editor.

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Anyone can read settings (rate) from the frontend
drop policy if exists "app_settings_select_all" on public.app_settings;
create policy "app_settings_select_all"
on public.app_settings
for select
to anon, authenticated
using (true);

-- Only admins can upsert/update settings
drop policy if exists "app_settings_upsert_admin" on public.app_settings;
create policy "app_settings_upsert_admin"
on public.app_settings
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "app_settings_update_admin" on public.app_settings;
create policy "app_settings_update_admin"
on public.app_settings
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

-- Seed default rate (IQD per 1 USD). Change anytime from admin UI.
insert into public.app_settings (key, value)
values ('usd_iqd_rate', '1300')
on conflict (key) do nothing;

