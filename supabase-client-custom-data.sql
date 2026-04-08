alter table public.clients
  add column if not exists profile_custom_answers jsonb not null default '{}'::jsonb;

alter table public.appointments
  add column if not exists custom_answers jsonb not null default '[]'::jsonb;
