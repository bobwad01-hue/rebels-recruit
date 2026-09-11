create or replace function public.materialize_player_record(target_record uuid, target_user uuid)
returns integer
language plpgsql
security definer
set search_path='public'
as $$
declare
  rec record;
  item record;
  rel_status public.pipeline_stage;
  interaction_id uuid;
  n int := 0;
begin
  select * into rec from public.organization_player_records where id=target_record;
  if rec.id is null then raise exception 'Player record not found'; end if;
  if target_user is null then raise exception 'Player account required'; end if;
  if auth.uid() is not null and auth.uid() is distinct from target_user and not public.is_org_owner_admin(rec.organization_id) then raise exception 'Not allowed'; end if;
  update public.organization_player_records set claimed_user_id=target_user,status='claimed',claimed_at=coalesce(claimed_at,now()),updated_at=now() where id=target_record;
  insert into public.organization_members(organization_id,user_id,role,status,joined_at)
    values(rec.organization_id,target_user,'athlete','pending',now())
    on conflict (organization_id,user_id) do nothing;
  for item in select * from public.organization_player_import_items where player_record_id=target_record and materialized_at is null order by created_at loop
    if item.college_id is null then continue; end if;
    begin rel_status := coalesce(nullif(item.stage,''),'Researching')::public.pipeline_stage; exception when others then rel_status := 'Researching'::public.pipeline_stage; end;
    insert into public.athlete_colleges(athlete_user_id,college_id,status) values(target_user,item.college_id,rel_status) on conflict (athlete_user_id,college_id) do nothing;
    if item.coach_id is not null then insert into public.athlete_coaches(athlete_user_id,college_id,coach_id) values(target_user,item.college_id,item.coach_id) on conflict (athlete_user_id,coach_id) do nothing; end if;
    if coalesce(item.note,'')<>'' or item.activity_date is not null or coalesce(item.activity_type,'')<>'' then
      if not exists(select 1 from public.interactions i where i.athlete_user_id=target_user and i.college_id=item.college_id and coalesce(i.coach_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(item.coach_id,'00000000-0000-0000-0000-000000000000'::uuid) and i.type=coalesce(nullif(item.activity_type,''),'Imported Recruiting Activity') and coalesce(i.date,'0001-01-01'::date)=coalesce(item.activity_date,'0001-01-01'::date) and coalesce(i.note,'')=coalesce(item.note,'')) then
        insert into public.interactions(athlete_user_id,actor_user_id,college_id,coach_id,type,initiated_by,date,date_precision,date_year,date_month,note,source_organization_id,import_batch_id)
        values(target_user,target_user,item.college_id,item.coach_id,coalesce(nullif(item.activity_type,''),'Imported Recruiting Activity'),'Athlete',item.activity_date,item.date_precision,item.date_year,item.date_month,nullif(item.note,''),rec.organization_id,item.batch_id) returning id into interaction_id;
        if item.coach_id is not null then insert into public.interaction_recipients(interaction_id,coach_id,recipient_type) values(interaction_id,item.coach_id,'to') on conflict do nothing; end if;
      end if;
    end if;
    update public.organization_player_import_items set materialized_at=now() where id=item.id;
    n := n+1;
  end loop;
  return n;
end $$;
revoke all on function public.materialize_player_record(uuid,uuid) from public;
grant execute on function public.materialize_player_record(uuid,uuid) to authenticated;
revoke all on function public.claim_pending_player_records_for_current_user() from public;
grant execute on function public.claim_pending_player_records_for_current_user() to authenticated;
revoke all on function public.accept_organization_membership(uuid) from public;
grant execute on function public.accept_organization_membership(uuid) to authenticated;
revoke all on function public.leave_organization(uuid) from public;
grant execute on function public.leave_organization(uuid) to authenticated;
revoke all on function public.join_organization_by_code(text) from public;
grant execute on function public.join_organization_by_code(text) to authenticated;