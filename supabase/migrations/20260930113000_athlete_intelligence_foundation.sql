create table if not exists public.athlete_intelligence_settings (
  athlete_user_id uuid primary key references auth.users(id) on delete cascade,
  guided_exploration_enabled boolean not null default true,
  last_prompted_at timestamptz,
  prompts_answered integer not null default 0,
  prompts_dismissed integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.athlete_preference_signals (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  signal_key text not null,
  signal_value text not null,
  source text not null check (source in ('explicit','behavior','advisor','derived')),
  confidence numeric(4,3) not null default 0.5 check (confidence between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  confirmed_by_athlete boolean not null default false,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists athlete_preference_signals_athlete_idx on public.athlete_preference_signals(athlete_user_id,signal_key);
create table if not exists public.athlete_intelligence_responses (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  prompt_key text not null,
  prompt_context jsonb not null default '{}'::jsonb,
  response_value text,
  skipped boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists athlete_intelligence_responses_athlete_idx on public.athlete_intelligence_responses(athlete_user_id,created_at desc);
alter table public.athlete_intelligence_settings enable row level security;
alter table public.athlete_preference_signals enable row level security;
alter table public.athlete_intelligence_responses enable row level security;
drop policy if exists athlete_intelligence_settings_self on public.athlete_intelligence_settings;
create policy athlete_intelligence_settings_self on public.athlete_intelligence_settings for all using (athlete_user_id=auth.uid()) with check (athlete_user_id=auth.uid());
drop policy if exists athlete_preference_signals_self on public.athlete_preference_signals;
create policy athlete_preference_signals_self on public.athlete_preference_signals for all using (athlete_user_id=auth.uid()) with check (athlete_user_id=auth.uid());
drop policy if exists athlete_intelligence_responses_self on public.athlete_intelligence_responses;
create policy athlete_intelligence_responses_self on public.athlete_intelligence_responses for all using (athlete_user_id=auth.uid()) with check (athlete_user_id=auth.uid());