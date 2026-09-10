create table if not exists public.athlete_videos (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'Other',
  provider text not null default 'other',
  video_url text not null,
  thumbnail_url text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athlete_videos_category_check check (category in ('Highlight Reel','Skills Video','Game Film','Hitting','Fielding','Pitching','Catching','Other')),
  constraint athlete_videos_provider_check check (provider in ('youtube','hudl','vimeo','sportsrecruits','other','rebels_recruit')),
  constraint athlete_videos_video_url_check check (length(trim(video_url)) > 0),
  constraint athlete_videos_title_check check (length(trim(title)) > 0)
);

create index if not exists athlete_videos_athlete_created_idx on public.athlete_videos (athlete_user_id, created_at desc);

alter table public.athlete_videos enable row level security;

drop policy if exists "athletes manage own videos" on public.athlete_videos;
create policy "athletes manage own videos" on public.athlete_videos
for all to authenticated
using (athlete_user_id = auth.uid())
with check (athlete_user_id = auth.uid());

drop policy if exists "staff can view accessible athlete videos" on public.athlete_videos;
create policy "staff can view accessible athlete videos" on public.athlete_videos
for select to authenticated
using (public.can_access_athlete(athlete_user_id));
