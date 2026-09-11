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
  target_role text;
begin
  select * into rec from public.organization_player_records where id=target_record;
  if rec.id is null then raise exception 'Player record not found'; end if;
  if target_user is null then raise exception 'Player account required'; end if;
  select app_role::text into target_role from public.profiles where id=target_user;
  if target_role is distinct from 'athlete' then raise exception 'Imported player history can only be claimed by an athlete account'; end if;
  if auth.uid() is not null and auth.uid() is distinct from target_user and not public.is_org_owner_admin(rec.organization_id) then raise exception 'Not allowed'; end if;
  update public.organization_player_records set claimed_user_id=target_user,status='claimed',claimed_at=coalesce(claimed_at,now()),updated_at=now() where id=target_record;
  insert into public.organization_members(organization_id,user_id,role,status,joined_at)
    values(rec.organization_id,target_user,'athlete','pending',now())
    on conflict (organization_id,user_id) do nothing;
  for item in select * from public.organization_player_import_items where player_record_id=target_record and materialized_at is null order by created_at loop
    if item.college_id is null then continue; end if;
    rel_status := public.import_pipeline_stage(item.stage);
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

create or replace function public.claim_pending_player_records_for_current_user()
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  user_role text;
  rec record;
  claimed_count int := 0;
  materialized_count int := 0;
  m int;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select lower(btrim(email)),app_role::text into user_email,user_role from public.profiles where id=uid;
  if user_role is distinct from 'athlete' then return jsonb_build_object('claimed',0,'materialized',0); end if;
  if user_email is null or user_email='' then return jsonb_build_object('claimed',0,'materialized',0); end if;
  for rec in select id from public.organization_player_records where (claimed_user_id is null or claimed_user_id=uid) and email is not null and lower(btrim(email))=user_email and status<>'archived' loop
    m := public.materialize_player_record(rec.id,uid);
    claimed_count := claimed_count + 1;
    materialized_count := materialized_count + m;
  end loop;
  return jsonb_build_object('claimed',claimed_count,'materialized',materialized_count);
end $$;

create or replace function public.join_organization_by_code(code text)
returns uuid language plpgsql security definer set search_path='public' as $$
declare oid uuid; user_role text;
begin
  select app_role::text into user_role from public.profiles where id=auth.uid();
  if user_role is distinct from 'athlete' then raise exception 'Only athlete accounts can join an organization as a player'; end if;
  select id into oid from public.organizations where upper(join_code)=upper(btrim(code));
  if oid is null then raise exception 'Organization code not found'; end if;
  insert into public.organization_members(organization_id,user_id,role,status,joined_at)
    values(oid,auth.uid(),'athlete','active',now())
    on conflict (organization_id,user_id) do update set status='active',joined_at=now(),suspended_at=null,suspended_by=null;
  return oid;
end $$;

create or replace function public.sync_interaction_recipient_relationship()
returns trigger language plpgsql security definer set search_path='public' as $$
declare i record;
begin
  select athlete_user_id,college_id,date into i from public.interactions where id=new.interaction_id;
  if i.athlete_user_id is null or i.college_id is null then return new; end if;
  insert into public.athlete_coaches(athlete_user_id,college_id,coach_id,last_contact_date)
    values(i.athlete_user_id,i.college_id,new.coach_id,i.date)
    on conflict (athlete_user_id,coach_id) do update
      set college_id=excluded.college_id,
          last_contact_date=case when excluded.last_contact_date is null then public.athlete_coaches.last_contact_date when public.athlete_coaches.last_contact_date is null then excluded.last_contact_date else greatest(public.athlete_coaches.last_contact_date,excluded.last_contact_date) end;
  return new;
end $$;
drop trigger if exists interaction_recipient_sync_relationship on public.interaction_recipients;
create trigger interaction_recipient_sync_relationship after insert or update on public.interaction_recipients for each row execute function public.sync_interaction_recipient_relationship();