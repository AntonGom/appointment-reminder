create table if not exists public.client_reminder_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  source text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists client_reminder_history_owner_idx
  on public.client_reminder_history(owner_id, sent_at desc);

create index if not exists client_reminder_history_client_idx
  on public.client_reminder_history(client_id, sent_at desc);

alter table public.client_reminder_history enable row level security;

drop policy if exists "users can view own reminder history" on public.client_reminder_history;
create policy "users can view own reminder history"
on public.client_reminder_history
for select
using (auth.uid() = owner_id);

drop policy if exists "users can add own reminder history" on public.client_reminder_history;
create policy "users can add own reminder history"
on public.client_reminder_history
for insert
with check (auth.uid() = owner_id);

drop policy if exists "users can update own reminder history" on public.client_reminder_history;
create policy "users can update own reminder history"
on public.client_reminder_history
for update
using (auth.uid() = owner_id);

drop policy if exists "users can delete own reminder history" on public.client_reminder_history;
create policy "users can delete own reminder history"
on public.client_reminder_history
for delete
using (auth.uid() = owner_id);
