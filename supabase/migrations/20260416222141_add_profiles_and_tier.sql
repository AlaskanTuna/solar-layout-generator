-- Tiered daily project creation limits (Phase 8.4)
-- Adds a profiles table keyed to auth.users(id) with a user_tier enum.
-- Writes are locked to the service role; clients may only SELECT their own row.
-- A trigger auto-creates a FREE profile row whenever a new auth user is inserted.

-- 1. Enum
create type public.user_tier as enum ('FREE', 'PRO', 'ENTERPRISE');

-- 2. Table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tier public.user_tier not null default 'FREE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Per-user profile metadata including subscription tier.';
comment on column public.profiles.tier is 'Subscription tier controlling daily project creation quota.';

-- 3. Keep updated_at in sync
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 4. Row level security
alter table public.profiles enable row level security;

-- Authenticated users can read their own profile only.
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- INSERT/UPDATE/DELETE are intentionally denied to client roles; the service role bypasses RLS.

-- 5. Auto-provision profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. One-time backfill for existing users
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
