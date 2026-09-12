drop function if exists public.get_staff_recruiting_activity(uuid, integer);
create function public.get_staff_recruiting_activity(target_organization_id uuid, max_rows integer default 4000)
returns table (
  id uuid,
  athlete_user_id uuid,
  coach_id uuid,
  college_id uuid,
  type text,
  date date,
  date_precision text,
  date_year integer,
  date_month integer,
  created_at timestamptz,
  note text,
  initiated_by text,
  colleges jsonb,
  college_coaches jsonb
)
language sql
stable
security definer
set search_path = ''
as $function$
  with viewer as (
    select om.user_id
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner','admin','advisor')
    limit 1
  ), accessible as (
    select om.user_id as athlete_user_id
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.status = 'active'
      and om.role = 'athlete'
      and exists (select 1 from viewer)
      and public.can_access_athlete(om.user_id)
  )
  select i.id,
         i.athlete_user_id,
         i.coach_id,
         i.college_id,
         i.type,
         i.date,
         i.date_precision,
         i.date_year,
         i.date_month,
         i.created_at,
         i.note,
         i.initiated_by,
         case when c.id is null then null else jsonb_build_object('id',c.id,'name',c.name) end as colleges,
         case when cc.id is null then null else jsonb_build_object('id',cc.id,'first_name',cc.first_name,'last_name',cc.last_name,'title',cc.title) end as college_coaches
  from public.interactions i
  join accessible a on a.athlete_user_id = i.athlete_user_id
  left join public.colleges c on c.id = i.college_id
  left join public.college_coaches cc on cc.id = i.coach_id
  order by i.date desc nulls last, i.created_at desc
  limit greatest(1, least(coalesce(max_rows,4000),4000));
$function$;
revoke all on function public.get_staff_recruiting_activity(uuid, integer) from public;
grant execute on function public.get_staff_recruiting_activity(uuid, integer) to authenticated;