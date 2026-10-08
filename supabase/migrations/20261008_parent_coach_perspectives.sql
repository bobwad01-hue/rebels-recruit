-- Parent/Guardian feedback is distinct from athlete experiences and staff ratings.
-- A parent can submit one perspective per coach only while actively connected to
-- an athlete who has that coach in their Connections.
create table if not exists public.parent_coach_perspectives (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  coach_id uuid not null references public.college_coaches(id) on delete cascade,
  overall_experience smallint check (overall_experience between 1 and 5),
  communication smallint check (communication between 1 and 5),
  responsiveness smallint check (responsiveness between 1 and 5),
  follow_through smallint check (follow_through between 1 and 5),
  standing_clarity text check (standing_clarity in ('not_really','somewhat','very_clearly')),
  recommend_engaging text check (recommend_engaging in ('yes','maybe','no')),
  core_completed_at timestamptz not null default now(),
  publication_status text not null default 'eligible' check (publication_status in ('eligible','held','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_coach_perspectives_one_per_coach unique (parent_user_id,coach_id),
  constraint parent_coach_perspectives_nonempty check (
    overall_experience is not null or communication is not null or
    responsiveness is not null or follow_through is not null or
    standing_clarity is not null or recommend_engaging is not null
  )
);

create index if not exists parent_coach_perspectives_coach_idx
  on public.parent_coach_perspectives(coach_id)
  where publication_status = 'eligible';

alter table public.parent_coach_perspectives enable row level security;

revoke all on public.parent_coach_perspectives from public, anon, authenticated;
grant select on public.parent_coach_perspectives to authenticated;
grant insert (
  parent_user_id, athlete_user_id, college_id, coach_id,
  overall_experience, communication, responsiveness, follow_through,
  standing_clarity, recommend_engaging, core_completed_at, updated_at
) on public.parent_coach_perspectives to authenticated;
grant update (
  athlete_user_id, college_id, overall_experience, communication,
  responsiveness, follow_through, standing_clarity, recommend_engaging,
  core_completed_at, updated_at
) on public.parent_coach_perspectives to authenticated;
grant delete on public.parent_coach_perspectives to authenticated;

create policy "parents read own coach perspectives"
  on public.parent_coach_perspectives for select to authenticated
  using (parent_user_id = (select auth.uid()));

create policy "parents add coach perspectives for linked athletes"
  on public.parent_coach_perspectives for insert to authenticated
  with check (
    parent_user_id = (select auth.uid())
    and exists (
      select 1 from public.parent_guardian_access pga
      where pga.parent_user_id = (select auth.uid())
        and pga.athlete_user_id = parent_coach_perspectives.athlete_user_id
        and pga.status = 'active'
        and coalesce((pga.permissions->>'view_connections')::boolean,true)
    )
    and exists (
      select 1 from public.athlete_coaches ac
      where ac.athlete_user_id = parent_coach_perspectives.athlete_user_id
        and ac.coach_id = parent_coach_perspectives.coach_id
        and ac.college_id = parent_coach_perspectives.college_id
        and ac.archived_at is null
    )
  );

create policy "parents update own linked coach perspectives"
  on public.parent_coach_perspectives for update to authenticated
  using (parent_user_id = (select auth.uid()))
  with check (
    parent_user_id = (select auth.uid())
    and exists (
      select 1 from public.parent_guardian_access pga
      where pga.parent_user_id = (select auth.uid())
        and pga.athlete_user_id = parent_coach_perspectives.athlete_user_id
        and pga.status = 'active'
        and coalesce((pga.permissions->>'view_connections')::boolean,true)
    )
    and exists (
      select 1 from public.athlete_coaches ac
      where ac.athlete_user_id = parent_coach_perspectives.athlete_user_id
        and ac.coach_id = parent_coach_perspectives.coach_id
        and ac.college_id = parent_coach_perspectives.college_id
        and ac.archived_at is null
    )
  );

create policy "parents delete own coach perspectives"
  on public.parent_coach_perspectives for delete to authenticated
  using (parent_user_id = (select auth.uid()));

-- Aggregate-only public-to-authenticated summary. The view intentionally
-- contains no parent or athlete identifiers. Rating details are suppressed
-- until three distinct parents have contributed.
create or replace view public.parent_coach_perspective_summary as
select
  coach_id,
  count(*)::integer as response_count,
  case when count(*) >= 3 then round(avg(overall_experience),2) end as overall_experience,
  case when count(*) >= 3 then round(avg(communication),2) end as communication,
  case when count(*) >= 3 then round(avg(responsiveness),2) end as responsiveness,
  case when count(*) >= 3 then round(avg(follow_through),2) end as follow_through,
  case when count(*) >= 3 then round(100.0 * count(*) filter (where standing_clarity='not_really') / nullif(count(*) filter (where standing_clarity is not null),0))::integer end as clarity_not_really_percent,
  case when count(*) >= 3 then round(100.0 * count(*) filter (where standing_clarity='somewhat') / nullif(count(*) filter (where standing_clarity is not null),0))::integer end as clarity_somewhat_percent,
  case when count(*) >= 3 then round(100.0 * count(*) filter (where standing_clarity='very_clearly') / nullif(count(*) filter (where standing_clarity is not null),0))::integer end as clarity_very_clearly_percent,
  case when count(*) >= 3 then round(100.0 * count(*) filter (where recommend_engaging='yes') / nullif(count(*) filter (where recommend_engaging is not null),0))::integer end as recommend_yes_percent,
  case when count(*) >= 3 then round(100.0 * count(*) filter (where recommend_engaging='maybe') / nullif(count(*) filter (where recommend_engaging is not null),0))::integer end as recommend_maybe_percent,
  case when count(*) >= 3 then round(100.0 * count(*) filter (where recommend_engaging='no') / nullif(count(*) filter (where recommend_engaging is not null),0))::integer end as recommend_no_percent
from public.parent_coach_perspectives
where core_completed_at is not null and publication_status='eligible'
group by coach_id;

revoke all on public.parent_coach_perspective_summary from public,anon;
grant select on public.parent_coach_perspective_summary to authenticated;
