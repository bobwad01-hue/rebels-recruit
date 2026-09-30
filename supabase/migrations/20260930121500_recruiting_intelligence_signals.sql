alter table public.athlete_preference_signals add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.athlete_preference_signals add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.athlete_preference_signals add column if not exists signal_kind text not null default 'preference';
create table if not exists public.athlete_behavior_events (
 id uuid primary key default gen_random_uuid(), athlete_user_id uuid not null references auth.users(id) on delete cascade,
 organization_id uuid references public.organizations(id) on delete set null, team_id uuid references public.teams(id) on delete set null,
 event_type text not null, college_id uuid references public.colleges(id) on delete set null, coach_id uuid references public.college_coaches(id) on delete set null,
 metadata jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);
create index if not exists athlete_behavior_events_athlete_idx on public.athlete_behavior_events(athlete_user_id,occurred_at desc);
create index if not exists athlete_behavior_events_org_idx on public.athlete_behavior_events(organization_id,event_type,occurred_at desc);
alter table public.athlete_behavior_events enable row level security;
drop policy if exists athlete_behavior_events_self on public.athlete_behavior_events;
create policy athlete_behavior_events_self on public.athlete_behavior_events for all using (athlete_user_id=auth.uid()) with check (athlete_user_id=auth.uid());
drop policy if exists athlete_preference_signals_staff_read on public.athlete_preference_signals;
create policy athlete_preference_signals_staff_read on public.athlete_preference_signals for select using (
 exists(select 1 from public.organization_members om where om.organization_id=athlete_preference_signals.organization_id and om.user_id=auth.uid() and om.status='active' and om.role in ('admin','advisor'))
);
drop policy if exists athlete_behavior_events_staff_read on public.athlete_behavior_events;
create policy athlete_behavior_events_staff_read on public.athlete_behavior_events for select using (
 exists(select 1 from public.organization_members om where om.organization_id=athlete_behavior_events.organization_id and om.user_id=auth.uid() and om.status='active' and om.role in ('admin','advisor'))
);