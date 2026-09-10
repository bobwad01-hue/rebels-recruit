create table if not exists public.event_debriefs (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  coaches_spoken_to text,
  what_happened text,
  interest_signal text check (interest_signal is null or interest_signal in ('strong','positive','neutral','unclear','negative')),
  follow_up_needed boolean not null default true,
  follow_up_notes text,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(athlete_user_id,event_id)
);
alter table public.event_debriefs enable row level security;
drop policy if exists "athlete manages own event debriefs" on public.event_debriefs;
create policy "athlete manages own event debriefs" on public.event_debriefs for all to authenticated using (athlete_user_id=auth.uid()) with check (athlete_user_id=auth.uid());
drop policy if exists "staff views accessible event debriefs" on public.event_debriefs;
create policy "staff views accessible event debriefs" on public.event_debriefs for select to authenticated using (public.can_access_athlete(athlete_user_id));
create index if not exists event_debriefs_athlete_event_idx on public.event_debriefs(athlete_user_id,event_id);
