alter table public.athlete_profiles add column if not exists home_zip text;

create table if not exists public.college_fit_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  max_drive_minutes integer,
  distance_importance text,
  max_annual_cost integer,
  cost_importance text,
  athletic_aid_required text,
  divisions text[] not null default '{}',
  school_sizes text[] not null default '{}',
  settings text[] not null default '{}',
  weather_preferences text[] not null default '{}',
  academic_interests text[] not null default '{}',
  campus_experience text[] not null default '{}',
  city_access_preferences text[] not null default '{}',
  competition_preferences text[] not null default '{}',
  religious_affiliation_preferences text[] not null default '{}',
  school_types text[] not null default '{}',
  top_priorities text[] not null default '{}',
  notes text,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.college_fit_profiles enable row level security;
drop policy if exists "athletes manage own college fit profile" on public.college_fit_profiles;
create policy "athletes manage own college fit profile" on public.college_fit_profiles for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "advisors view accessible college fit profiles" on public.college_fit_profiles;
create policy "advisors view accessible college fit profiles" on public.college_fit_profiles for select to authenticated using (
 user_id=auth.uid() or exists(
  select 1 from public.organization_members viewer
  join public.organization_members athlete on athlete.organization_id=viewer.organization_id and athlete.user_id=college_fit_profiles.user_id and athlete.role='athlete' and athlete.status='active'
  where viewer.user_id=auth.uid() and viewer.status='active' and (
   viewer.role in ('owner','admin') or viewer.organization_view_access=true or exists(
    select 1 from public.athlete_advisor_assignments aaa where aaa.athlete_user_id=college_fit_profiles.user_id and aaa.advisor_user_id=auth.uid() and aaa.status='active'
   )
  )
 )
);
create index if not exists college_fit_profiles_updated_idx on public.college_fit_profiles(updated_at desc);
