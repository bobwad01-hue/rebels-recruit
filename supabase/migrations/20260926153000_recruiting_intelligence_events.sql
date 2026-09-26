create table if not exists public.recruiting_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  signal_id text not null,
  signal_kind text not null,
  surface text not null,
  event_type text not null check (event_type in ('shown','opened','dismissed','completed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists recruiting_intelligence_events_athlete_created_idx on public.recruiting_intelligence_events(athlete_user_id,created_at desc);
create index if not exists recruiting_intelligence_events_signal_idx on public.recruiting_intelligence_events(signal_kind,event_type,created_at desc);
alter table public.recruiting_intelligence_events enable row level security;
drop policy if exists recruiting_intelligence_events_read on public.recruiting_intelligence_events;
create policy recruiting_intelligence_events_read on public.recruiting_intelligence_events for select using (athlete_user_id=auth.uid() or public.can_access_athlete(athlete_user_id));
drop policy if exists recruiting_intelligence_events_insert on public.recruiting_intelligence_events;
create policy recruiting_intelligence_events_insert on public.recruiting_intelligence_events for insert with check (actor_user_id=auth.uid() and (athlete_user_id=auth.uid() or public.can_access_athlete(athlete_user_id)));
