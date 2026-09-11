alter table public.support_cases
  add column if not exists resolution_note text,
  add column if not exists resolved_by_user_id uuid references auth.users(id) on delete set null;

create table if not exists public.support_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('status_changed','note_updated')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.support_case_events enable row level security;

create index if not exists support_cases_organization_status_created_idx
  on public.support_cases(organization_id,status,created_at desc);
create index if not exists support_case_events_case_created_idx
  on public.support_case_events(case_id,created_at desc);
