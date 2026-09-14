create table if not exists public.production_error_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  environment text not null,
  source text not null,
  path text not null,
  error_name text not null,
  error_message text not null,
  error_digest text,
  user_agent text,
  release text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.production_error_events enable row level security;
revoke all on table public.production_error_events from anon, authenticated;
grant select, insert on table public.production_error_events to service_role;

create index if not exists production_error_events_created_at_idx
  on public.production_error_events (created_at desc);
create index if not exists production_error_events_digest_idx
  on public.production_error_events (error_digest, created_at desc)
  where error_digest is not null;

comment on table public.production_error_events is
  'Centralized, privacy-limited production error telemetry. Writes are performed through the server-side service role.';
