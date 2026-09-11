create or replace function public.update_support_case(
  target_case_id uuid,
  new_status text,
  resolution_text text default null
)
returns public.support_cases
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_case public.support_cases%rowtype;
  updated_case public.support_cases%rowtype;
  event_kind text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if new_status not in ('open','investigating','resolved') then
    raise exception 'Invalid support case status' using errcode = '22023';
  end if;

  select * into current_case
  from public.support_cases
  where id = target_case_id;

  if not found then
    raise exception 'Support case not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.organization_members staff
    where staff.user_id = current_user_id
      and staff.status = 'active'
      and staff.role in ('owner','admin')
      and (
        staff.organization_id = current_case.organization_id
        or (
          current_case.organization_id is null
          and exists (
            select 1 from public.organization_members reporter
            where reporter.user_id = current_case.reporter_user_id
              and reporter.organization_id = staff.organization_id
              and reporter.status = 'active'
          )
        )
      )
  ) then
    raise exception 'Not authorized for this support case' using errcode = '42501';
  end if;

  event_kind := case when current_case.status is distinct from new_status then 'status_changed' else 'note_updated' end;

  update public.support_cases
  set status = new_status,
      resolution_note = case when nullif(btrim(coalesce(resolution_text,'')),'') is null then resolution_note else btrim(resolution_text) end,
      resolved_at = case when new_status = 'resolved' then coalesce(resolved_at, now()) else null end,
      resolved_by_user_id = case when new_status = 'resolved' then current_user_id else null end,
      updated_at = now()
  where id = target_case_id
  returning * into updated_case;

  insert into public.support_case_events(case_id,actor_user_id,event_type,from_status,to_status,note)
  values(target_case_id,current_user_id,event_kind,current_case.status,new_status,nullif(btrim(coalesce(resolution_text,'')),''));

  return updated_case;
end;
$$;

revoke all on function public.update_support_case(uuid,text,text) from public;
grant execute on function public.update_support_case(uuid,text,text) to authenticated;
