alter table public.athlete_colleges
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

alter table public.athlete_coaches
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

create index if not exists athlete_colleges_active_idx
  on public.athlete_colleges (athlete_user_id, archived_at);

create index if not exists athlete_coaches_active_idx
  on public.athlete_coaches (athlete_user_id, archived_at);

comment on column public.athlete_colleges.archived_at is 'When the athlete stopped actively pursuing this college. Null means current pipeline.';
comment on column public.athlete_colleges.archived_reason is 'Optional reason the athlete stopped pursuing this college.';
comment on column public.athlete_coaches.archived_at is 'When the athlete stopped actively pursuing this coach relationship. Null means current pipeline.';
comment on column public.athlete_coaches.archived_reason is 'Optional reason the athlete stopped pursuing this coach relationship.';
