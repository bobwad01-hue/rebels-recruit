-- Release-candidate access hardening and family defaults.
-- Mirrors the production fixes verified on 2026-10-02.

alter table public.organization_user_roles enable row level security;
alter table public.team_user_roles enable row level security;
alter table public.organization_join_links enable row level security;
alter table public.organization_join_requests enable row level security;

alter function public.reject_organization_owner_role() set search_path = public, pg_temp;

create or replace function public.can_access_athlete(a uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_super_owner()
    or a = (select auth.uid())
    or exists (
      select 1
      from public.athlete_advisor_assignments aa
      where aa.athlete_user_id = a
        and aa.advisor_user_id = (select auth.uid())
        and aa.status = 'active'
    )
    or exists (
      select 1
      from public.organization_members me
      join public.organization_members athlete
        on athlete.organization_id = me.organization_id
      where me.user_id = (select auth.uid())
        and me.status = 'active'
        and athlete.user_id = a
        and athlete.status = 'active'
        and me.role in ('owner','admin')
    );
$$;

drop policy if exists "parents view linked reminders" on public.reminders;
create policy "parents view linked reminders" on public.reminders
for select to authenticated
using (public.parent_can_view_athlete(athlete_user_id,'view_game_plan'));

drop policy if exists "parents view linked advisor tasks" on public.advisor_tasks;
create policy "parents view linked advisor tasks" on public.advisor_tasks
for select to authenticated
using (public.parent_can_view_athlete(athlete_user_id,'view_game_plan'));

alter table public.parent_guardian_access
alter column permissions set default '{"view_fit":true,"view_events":true,"view_videos":true,"view_activity":true,"view_progress":true,"view_discovery":true,"view_game_plan":true,"manage_calendar":true,"view_connections":true,"manage_history_import":true}'::jsonb;
