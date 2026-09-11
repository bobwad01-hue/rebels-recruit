create or replace function public.get_parent_journey(target_athlete_id uuid)
returns table(
  id uuid,
  type text,
  date date,
  date_precision text,
  date_year integer,
  date_month integer,
  created_at timestamptz,
  note text,
  initiated_by text,
  college_id uuid,
  college_name text,
  coach_id uuid,
  coach_first_name text,
  coach_last_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.type, i.date, i.date_precision, i.date_year, i.date_month,
         i.created_at, i.note, i.initiated_by,
         c.id, c.name,
         cc.id, cc.first_name, cc.last_name
  from public.interactions i
  left join public.colleges c on c.id = i.college_id
  left join public.college_coaches cc on cc.id = i.coach_id
  where i.athlete_user_id = target_athlete_id
    and (
      public.parent_can_view_athlete(target_athlete_id, 'view_activity')
      or exists (
        select 1
        from public.organization_members viewer
        join public.organization_members athlete
          on athlete.organization_id = viewer.organization_id
        where viewer.user_id = (select auth.uid())
          and viewer.status = 'active'
          and viewer.role in ('owner','admin')
          and athlete.user_id = target_athlete_id
          and athlete.role = 'athlete'
          and athlete.status = 'active'
      )
    )
  order by i.date desc nulls last, i.created_at desc
  limit 500;
$$;

revoke all on function public.get_parent_journey(uuid) from public;
grant execute on function public.get_parent_journey(uuid) to authenticated;
