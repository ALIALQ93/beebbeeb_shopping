-- Run this ONCE in Supabase SQL Editor
-- Purpose:
-- 1) Ensure every auth user gets a row in public.profiles automatically
-- 2) Allow the user to upsert/update their own profile (for name/phone)

-- 0) Add phone column if missing
alter table if exists public.profiles
add column if not exists phone text;

-- 1) Allow authenticated users to insert their own profile row (needed for upsert)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_insert_own'
  ) then
    execute $p$
      create policy "profiles_insert_own"
      on public.profiles for insert
      to authenticated
      with check (id = auth.uid());
    $p$;
  end if;
end $$;

-- 2) Trigger: create profile automatically when a new auth user is created
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'phone', null),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

