create or replace function public.start_parent_conversation(target_athlete_id uuid, conversation_subject text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from parent_guardian_access
    where parent_user_id=auth.uid()
      and athlete_user_id=target_athlete_id
      and status='active'
  ) then raise exception 'Parent access is not active for this athlete'; end if;
  insert into advisor_conversations(conversation_type,subject,created_by_user_id)
  values('direct',nullif(btrim(conversation_subject),''),auth.uid())
  returning id into new_id;
  insert into advisor_conversation_members(conversation_id,user_id)
  values(new_id,auth.uid()),(new_id,target_athlete_id);
  return new_id;
end;
$$;
grant execute on function public.start_parent_conversation(uuid,text) to authenticated;
