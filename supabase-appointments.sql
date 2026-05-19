create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  client_email text,
  client_phone text,
  service_date date not null,
  service_time time,
  service_location text,
  notes text,
  last_channel text check (last_channel in ('email', 'sms')),
  last_source text,
  source_type text,
  source_external_id text,
  source_signature text,
  source_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointments
  add column if not exists source_type text,
  add column if not exists source_external_id text,
  add column if not exists source_signature text,
  add column if not exists source_synced_at timestamptz;

create index if not exists appointments_owner_date_idx
  on public.appointments(owner_id, service_date asc, service_time asc);

create index if not exists appointments_client_idx
  on public.appointments(client_id, service_date asc);

create index if not exists appointments_source_external_idx
  on public.appointments(owner_id, source_type, source_external_id)
  where source_external_id is not null;

create index if not exists appointments_source_signature_idx
  on public.appointments(owner_id, source_signature)
  where source_signature is not null;

alter table public.appointments enable row level security;

drop policy if exists "users can view own appointments" on public.appointments;
create policy "users can view own appointments"
on public.appointments
for select
using (auth.uid() = owner_id);

drop policy if exists "users can add own appointments" on public.appointments;
create policy "users can add own appointments"
on public.appointments
for insert
with check (auth.uid() = owner_id);

drop policy if exists "users can update own appointments" on public.appointments;
create policy "users can update own appointments"
on public.appointments
for update
using (auth.uid() = owner_id);

drop policy if exists "users can delete own appointments" on public.appointments;
create policy "users can delete own appointments"
on public.appointments
for delete
using (auth.uid() = owner_id);
