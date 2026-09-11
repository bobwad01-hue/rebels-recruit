create or replace function public.create_support_case(case_category text, case_description text)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; snap jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if case_category not in ('missing_athlete','wrong_organization_access','missing_import_history','google_disconnected','wrong_team','parent_access','account_deletion','other') then raise exception 'Invalid support category'; end if;
 if length(trim(coalesce(case_description,'')))<5 then raise exception 'Please include a short description'; end if;
 select jsonb_build_object(
  'captured_at',now(),
  'active_organizations',(select coalesce(jsonb_agg(jsonb_build_object('organization_id',organization_id,'role',role,'status',status)),'[]'::jsonb) from public.organization_members where user_id=auth.uid() and status='active'),
  'parent_links_as_parent',(select count(*) from public.parent_guardian_access where parent_user_id=auth.uid() and status='active'),
  'parent_links_as_athlete',(select count(*) from public.parent_guardian_access where athlete_user_id=auth.uid() and status='active'),
  'school_count',(select count(*) from public.athlete_colleges where athlete_user_id=auth.uid()),
  'coach_relationship_count',(select count(*) from public.athlete_coaches where athlete_user_id=auth.uid()),
  'interaction_count',(select count(*) from public.interactions where athlete_user_id=auth.uid()),
  'google_connection',(select coalesce(jsonb_build_object('calendar_connected',calendar_connected,'connected_at',connected_at,'updated_at',updated_at),'null'::jsonb) from public.google_workspace_connections where user_id=auth.uid() limit 1)
 ) into snap;
 insert into public.support_cases(reporter_user_id,category,description,diagnostic_snapshot) values(auth.uid(),case_category,trim(case_description),snap) returning id into rid;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),'support_case_created','support_case',rid,jsonb_build_object('category',case_category));
 return rid;
end$$;
revoke all on function public.create_support_case(text,text) from public;
grant execute on function public.create_support_case(text,text) to authenticated;
