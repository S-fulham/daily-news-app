-- Run this in the Supabase Dashboard -> SQL Editor (one-time setup).

-- 1. Profiles table: one row per auth user, tracks subscription/category access.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  subscription_status text not null default 'free',
  unlocked_categories text[] not null default array['general'],
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Stories table: daily pipeline output. Written by the Python script
--    using the service_role key, which bypasses RLS entirely.
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  story_date date not null default current_date,
  category text not null default 'general',
  rank int not null default 0,
  article text not null,
  outlet_count int not null default 0,
  article_count int not null default 0,
  headlines jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

alter table public.stories enable row level security;

-- Only 'general' has real content in the MVP, but this checks a user's
-- unlocked_categories so it keeps working once other categories ship.
create policy "Authenticated users can read unlocked stories"
  on public.stories for select
  to authenticated
  using (
    category = 'general'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and category = any(p.unlocked_categories)
    )
  );

create index if not exists stories_date_category_idx
  on public.stories (story_date, category, rank);
