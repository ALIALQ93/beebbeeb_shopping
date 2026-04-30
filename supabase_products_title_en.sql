-- English title for products
-- Run once in Supabase SQL Editor.

alter table public.products
add column if not exists title_en text;

