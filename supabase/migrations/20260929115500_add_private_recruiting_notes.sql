create table if not exists public.recruiting_private_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid references public.colleges(id) on delete cascade,
  coach_id uuid references public.college_coaches(id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now(),
  constraint recruiting_private_notes_subject_check check (college_id is not null or coach_id is not null)
);
create unique index if not exists recruiting_private_notes_coach_unique on public.recruiting_private_notes(user_id,athlete_user_id,coach_id) where coach_id is not null;
create unique index if not exists recruiting_private_notes_college_unique on public.recruiting_private_notes(user_id,athlete_user_id,college_id) where college_id is not null and coach_id is null;
alter table public.recruiting_private_notes enable row level security;
create policy "Users manage own recruiting notes" on public.recruiting_private_notes for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);