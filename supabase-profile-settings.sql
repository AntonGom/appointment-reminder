create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  tier text,
  custom_form_profile jsonb not null default '{}'::jsonb,
  branding_profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists tier text,
  add column if not exists custom_form_profile jsonb not null default '{}'::jsonb,
  add column if not exists branding_profile jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;

drop policy if exists "Users can read their profile settings" on public.profiles;
create policy "Users can read their profile settings"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can insert their profile settings" on public.profiles;
create policy "Users can insert their profile settings"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their profile settings" on public.profiles;
create policy "Users can update their profile settings"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
