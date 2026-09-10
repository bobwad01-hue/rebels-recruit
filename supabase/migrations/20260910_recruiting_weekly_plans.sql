create table if not exists public.recruiting_weekly_plans (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  goals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_user_id, week_start)
);

create index if not exists recruiting_weekly_plans_athlete_week_idx
  on public.recruiting_weekly_plans (athlete_user_id, week_start desc);

alter table public.recruiting_weekly_plans enable row level security;

drop policy if exists weekly_plans_access on public.recruiting_weekly_plans;
create policy weekly_plans_access on public.recruiting_weekly_plans
  for all
  using ((athlete_user_id = auth.uid()) or can_access_athlete(athlete_user_id))
  with check ((athlete_user_id = auth.uid()) or can_access_athlete(athlete_user_id));

drop policy if exists "parents view linked weekly plan" on public.recruiting_weekly_plans;
create policy "parents view linked weekly plan" on public.recruiting_weekly_plans
  for select
  using (parent_can_view_athlete(athlete_user_id, 'view_game_plan'::text));
