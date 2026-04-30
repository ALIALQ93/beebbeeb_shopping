-- Password reset requests (manual workflow)
-- Customers insert a request (anon). Admins can view/update.

create table if not exists public.password_reset_requests (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  full_name text not null,
  phone text not null,
  note text,
  status text not null default 'open',
  handled_by uuid null,
  handled_at timestamptz null
);

-- Keep it simple: prevent duplicate open requests per phone.
create unique index if not exists password_reset_requests_open_phone_unique
  on public.password_reset_requests (phone)
  where status = 'open';

alter table public.password_reset_requests enable row level security;

-- Allow anyone to create a reset request.
drop policy if exists "password_reset_requests_insert_anon" on public.password_reset_requests;
create policy "password_reset_requests_insert_anon"
on public.password_reset_requests
for insert
to anon, authenticated
with check (
  status = 'open'
  and phone is not null
  and length(phone) >= 10
);

-- Admins can view requests.
drop policy if exists "password_reset_requests_select_admin" on public.password_reset_requests;
create policy "password_reset_requests_select_admin"
on public.password_reset_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

-- Admins can update status/handled fields.
drop policy if exists "password_reset_requests_update_admin" on public.password_reset_requests;
create policy "password_reset_requests_update_admin"
on public.password_reset_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

