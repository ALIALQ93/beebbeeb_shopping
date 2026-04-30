-- Product attributes: colors + age ranges (multi-select)
-- Run once in Supabase SQL Editor.

alter table public.products
add column if not exists colors text[] not null default '{}'::text[];

alter table public.products
add column if not exists age_ranges text[] not null default '{}'::text[];

