create table if not exists public.client_reminder_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  source text not null,
  message_id text,
  recipient_email text,
  event_type text not null default 'sent',
  status text not null default 'sent',
  occurred_at timestamptz,
  event_key text,
  message_preview text,
  raw_event jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.client_reminder_history
  alter column client_id drop not null,
  add column if not exists message_id text,
  add column if not exists recipient_email text,
  add column if not exists event_type text not null default 'sent',
  add column if not exists status text not null default 'sent',
  add column if not exists occurred_at timestamptz,
  add column if not exists event_key text,
  add column if not exists message_preview text,
  add column if not exists raw_event jsonb;

update public.client_reminder_history
set
  occurred_at = coalesce(occurred_at, sent_at, created_at),
  event_type = coalesce(nullif(event_type, ''), 'sent'),
  status = coalesce(nullif(status, ''), 'sent'),
  event_key = coalesce(
    nullif(event_key, ''),
    concat_ws(':',
      coalesce(nullif(message_id, ''), id::text, 'legacy'),
      coalesce(nullif(event_type, ''), 'sent'),
      extract(epoch from coalesce(occurred_at, sent_at, created_at))::bigint,
      coalesce(lower(nullif(recipient_email, '')), 'legacy'),
      id::text
    )
  );

create index if not exists client_reminder_history_owner_idx
  on public.client_reminder_history(owner_id, sent_at desc);

create index if not exists client_reminder_history_client_idx
  on public.client_reminder_history(client_id, sent_at desc);

create index if not exists client_reminder_history_message_idx
  on public.client_reminder_history(message_id, sent_at desc);

create unique index if not exists client_reminder_history_event_key_idx
  on public.client_reminder_history(event_key);

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
