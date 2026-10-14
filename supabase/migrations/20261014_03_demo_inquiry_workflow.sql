-- Extend the existing private organization inquiry workflow.
alter table public.organization_demo_requests
  add column if not exists phone text check (phone is null or char_length(phone) <= 30),
  add column if not exists preferred_contact text not null default 'either' check (preferred_contact in ('either','email','phone')),
  add column if not exists internal_notes text check (internal_notes is null or char_length(internal_notes) <= 6000),
  add column if not exists follow_up_at date,
  add column if not exists alert_acknowledged_at timestamptz,
  add column if not exists alert_dismissed_at timestamptz,
  add column if not exists last_reviewed_by uuid;
alter table public.organization_demo_requests
  drop constraint if exists organization_demo_requests_status_check;
alter table public.organization_demo_requests
  add constraint organization_demo_requests_status_check
    check (status in ('new','contacted','demo_scheduled','won','lost','closed'));
create index if not exists organization_demo_requests_follow_up_idx
  on public.organization_demo_requests (follow_up_at) where follow_up_at is not null;
create table if not exists public.organization_demo_request_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.organization_demo_requests(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null check (event_type in ('status','notes','follow_up','acknowledged','dismissed')),
  summary text not null check (char_length(summary) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists organization_demo_request_events_inquiry_idx
  on public.organization_demo_request_events (inquiry_id,created_at desc);
alter table public.organization_demo_request_events enable row level security;
revoke all on table public.organization_demo_request_events from anon, authenticated;
comment on table public.organization_demo_request_events is
  'Service-role-only audit history for private commercial inquiry changes.';
