create table if not exists public.parent_school_advice (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  advice text not null check (advice in ('consider','pass')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_user_id, athlete_user_id, college_id)
);
create index if not exists parent_school_advice_athlete_college_idx on public.parent_school_advice(athlete_user_id,college_id);
create index if not exists parent_school_advice_parent_athlete_idx on public.parent_school_advice(parent_user_id,athlete_user_id);
alter table public.parent_school_advice enable row level security;
create policy parent_school_advice_select on public.parent_school_advice for select to authenticated using (parent_user_id=auth.uid() or athlete_user_id=auth.uid() or public.can_access_athlete(athlete_user_id));
create policy parent_school_advice_write on public.parent_school_advice for insert to authenticated with check (parent_user_id=auth.uid() and exists(select 1 from public.parent_guardian_access pga where pga.parent_user_id=auth.uid() and pga.athlete_user_id=parent_school_advice.athlete_user_id and pga.status='active' and coalesce((pga.permissions->>'view_discovery')::boolean,true)=true));
create policy parent_school_advice_update on public.parent_school_advice for update to authenticated using(parent_user_id=auth.uid()) with check(parent_user_id=auth.uid());
create policy parent_school_advice_delete on public.parent_school_advice for delete to authenticated using(parent_user_id=auth.uid());
alter table public.parent_guardian_access alter column permissions set default '{"view_discovery":true,"view_connections":true,"view_activity":true,"view_events":true,"view_fit":true,"view_progress":true,"view_videos":true,"view_game_plan":true,"manage_calendar":false,"manage_history_import":true}'::jsonb;
update public.parent_guardian_access set permissions=jsonb_set(coalesce(permissions,'{}'::jsonb),'{manage_history_import}','true'::jsonb,true),updated_at=now() where status='active' and coalesce((permissions->>'manage_history_import')::boolean,false)=false;