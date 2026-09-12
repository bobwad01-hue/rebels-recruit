create or replace function public.get_staff_recruiting_activity(target_organization_id uuid, max_rows integer default 4000)
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
  college_name text,
  coach_first_name text,
  coach_last_name text,
  coach_title text
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
         c.name as college_name,
         cc.first_name as coach_first_name,
         cc.last_name as coach_last_name,
         cc.title as coach_title
  from public.interactions i
  join accessible a on a.athlete_user_id = i.athlete_user_id
  left join public.colleges c on c.id = i.college_id
  left join public.college_coaches cc on cc.id = i.coach_id
  order by i.date desc nulls last, i.created_at desc
  limit greatest(1, least(coalesce(max_rows,4000),4000));
$function$;

revoke all on function public.get_staff_recruiting_activity(uuid, integer) from public;
grant execute on function public.get_staff_recruiting_activity(uuid, integer) to authenticated;

create index if not exists interactions_athlete_precision_date_idx
  on public.interactions (athlete_user_id, date_precision, date desc);
create index if not exists athlete_colleges_athlete_archived_status_idx
  on public.athlete_colleges (athlete_user_id, archived_at, status);
create index if not exists athlete_coaches_athlete_archived_idx
  on public.athlete_coaches (athlete_user_id, archived_at);