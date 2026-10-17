-- The Team Admin helper must never authorize a person simply because
-- they are the athlete. Athlete self-access belongs in can_access_athlete.
create or replace function public.team_admin_can_access_athlete(a uuid)
returns boolean language sql stable security definer set search_path = ''
as $body$
 select not exists (
   select 1 from public.athlete_team_admin_revocations denied
   where denied.athlete_user_id = a and denied.admin_user_id = (select auth.uid())
 )
 and exists (
   select 1
   from public.team_user_roles staff
   join public.teams t on t.id = staff.team_id and t.archived_at is null
   join public.team_members athlete on athlete.team_id = t.id and athlete.user_id = a
   where staff.user_id = (select auth.uid())
    and staff.role = 'admin' and staff.status = 'active'
    and exists (
     select 1 from public.organization_members staff_member
     where staff_member.user_id = (select auth.uid())
      and staff_member.organization_id = t.organization_id
      and staff_member.status = 'active'
    )
    and exists (
     select 1 from public.organization_members m
     where m.user_id = a and m.organization_id = t.organization_id
      and m.status = 'active'
    )
    and exists (select 1 from public.athlete_profiles ap where ap.user_id = a)
 );
$body$;
