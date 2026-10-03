create table if not exists public.athlete_recruiting_experiences (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  subject_type text not null default 'program' check (subject_type in ('program','staff','coach')),
  college_id uuid not null references public.colleges(id) on delete cascade,
  coach_id uuid references public.college_coaches(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  overall_experience smallint check (overall_experience between 1 and 5),
  communication smallint check (communication between 1 and 5),
  standing_clarity text check (standing_clarity is null or standing_clarity in ('not_really','somewhat','very_clearly')),
  recommend_engaging text check (recommend_engaging is null or recommend_engaging in ('yes','maybe','no')),
  recruiting_stage text,
  context jsonb not null default '{}'::jsonb,
  core_completed_at timestamptz,
  dismissed_at timestamptz,
  publication_status text not null default 'private' check (publication_status in ('private','eligible','held','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (overall_experience is not null or communication is not null or standing_clarity is not null or recommend_engaging is not null or dismissed_at is not null)
);
create unique index if not exists athlete_recruiting_experiences_program_unique on public.athlete_recruiting_experiences(athlete_user_id,college_id) where subject_type='program' and coach_id is null;
create index if not exists athlete_recruiting_experiences_college_idx on public.athlete_recruiting_experiences(college_id,publication_status,created_at desc);
create index if not exists athlete_recruiting_experiences_coach_idx on public.athlete_recruiting_experiences(coach_id,publication_status,created_at desc) where coach_id is not null;
alter table public.athlete_recruiting_experiences enable row level security;
drop policy if exists athlete_recruiting_experiences_self on public.athlete_recruiting_experiences;
create policy athlete_recruiting_experiences_self on public.athlete_recruiting_experiences for all to authenticated using (athlete_user_id=auth.uid()) with check (athlete_user_id=auth.uid());
comment on table public.athlete_recruiting_experiences is 'Private source records for anonymous aggregate Peer Recruiting Insights. Athlete identity is never exposed by direct client reads.';
