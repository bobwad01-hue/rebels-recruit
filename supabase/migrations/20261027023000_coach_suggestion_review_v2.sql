-- RLTNL coach data review: verify, apply and notify are independent decisions.
-- Backward-compatible RPC: the existing function remains available during rollout.
-- Evidence is owner-only; suggestion rows themselves are readable by their submitters.
create table if not exists public.college_coach_suggestion_review_evidence (
 suggestion_id uuid primary key references public.college_coach_update_suggestions(id) on delete cascade,
 verification_note text,
 verification_source_url text,
 reviewed_by_user_id uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz not null default now()
);
alter table public.college_coach_suggestion_review_evidence enable row level security;
drop policy if exists coach_suggestion_evidence_super_owner_read on public.college_coach_suggestion_review_evidence;
create policy coach_suggestion_evidence_super_owner_read
 on public.college_coach_suggestion_review_evidence for select to authenticated
 using (exists(
  select 1 from public.platform_roles where user_id=auth.uid() and role='super_owner'
 ));
revoke all on public.college_coach_suggestion_review_evidence from anon,authenticated;
grant select on public.college_coach_suggestion_review_evidence to authenticated;

create or replace function public.review_college_coach_suggestion_v2(
 p_id uuid,
 p_decision text,
 p_notify boolean default true,
 p_message text default null,
 p_source_url text default null,
 p_review_note text default null,
 p_message_source_url text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
 v_actor uuid := auth.uid();
 v_suggestion public.college_coach_update_suggestions%rowtype;
 v_coach public.college_coaches%rowtype;
 v_school text;
 v_name text;
 v_kind text;
 v_body text := nullif(btrim(coalesce(p_message,'')),'');
 v_source text := nullif(btrim(coalesce(p_source_url,'')),'');
 v_review_note text := nullif(btrim(coalesce(p_review_note,'')),'');
 v_message_source text := nullif(btrim(coalesce(p_message_source_url,'')),'');
 v_thread_id uuid;
 v_sent boolean := false;
 v_automatic boolean := false;
 v_has_change boolean := false;
 v_status text;
begin
 if v_actor is null or not exists(
  select 1 from public.platform_roles where user_id=v_actor and role='super_owner'
 ) then raise exception 'Super Owner access required' using errcode='42501'; end if;

 if p_decision not in ('accept','verify_only','reject') then raise exception 'Invalid review decision'; end if;
 if p_notify is null then raise exception 'Invalid notification preference'; end if;
 if v_body is not null and length(v_body)>4000 then raise exception 'Message must be 4,000 characters or fewer'; end if;
 if v_review_note is not null and length(v_review_note)>2000 then raise exception 'Verification notes must be 2,000 characters or fewer'; end if;
 if v_source is not null and (length(v_source)>1500 or v_source !~* '^https://[^[:space:]]+$')
 then raise exception 'Verification source must be an HTTPS URL'; end if;
 if v_message_source is not null and (length(v_message_source)>1500 or v_message_source !~* '^https://[^[:space:]]+$')
 then raise exception 'Message source must be an HTTPS URL'; end if;
 if not p_notify and (v_body is not null or v_message_source is not null)
 then raise exception 'A message cannot be sent when notifications are off'; end if;
 if p_decision='reject' and p_notify and length(coalesce(v_body,''))<20
 then raise exception 'Write at least 20 characters explaining the rejection or turn off notifications'; end if;
 if v_message_source is not null and v_body is null
 then raise exception 'Add a personal message to share the source link'; end if;

 select * into v_suggestion from public.college_coach_update_suggestions where id=p_id for update;
 if not found then raise exception 'Suggestion not found'; end if;
 if v_suggestion.status<>'pending' then raise exception 'Suggestion has already been reviewed'; end if;
 select * into v_coach from public.college_coaches where id=v_suggestion.coach_id for update;
 if not found then raise exception 'Coach record not found'; end if;
 v_name=concat_ws(' ',nullif(btrim(v_coach.first_name),''),nullif(btrim(v_coach.last_name),''));
 if v_name='' then v_name='this coach'; end if;
 select name into v_school from public.colleges where id=v_coach.college_id;
 v_kind=case v_suggestion.suggestion_type
  when 'contact_update' then 'contact information'
  when 'incorrect_info' then 'information correction'
  when 'title_update' then 'coaching title'
  when 'left_program' then 'coaching staff status'
  when 'moved_school' then 'school affiliation'
  when 'retired' then 'retirement status'
  else 'coach information' end;

 if p_decision='accept' then
  -- Apply actual proposed field differences regardless of the submission category.
  -- In particular, "other" can include a valid email/phone correction.
  v_has_change=(
   (nullif(btrim(v_suggestion.proposed_first_name),'') is not null and
    btrim(v_suggestion.proposed_first_name) is distinct from btrim(coalesce(v_coach.first_name,''))) or
   (nullif(btrim(v_suggestion.proposed_last_name),'') is not null and
    btrim(v_suggestion.proposed_last_name) is distinct from btrim(coalesce(v_coach.last_name,''))) or
   (nullif(btrim(v_suggestion.proposed_title),'') is not null and
    btrim(v_suggestion.proposed_title) is distinct from btrim(coalesce(v_coach.title,''))) or
   (nullif(btrim(v_suggestion.proposed_email),'') is not null and
    btrim(v_suggestion.proposed_email) is distinct from btrim(coalesce(v_coach.email,''))) or
   (nullif(btrim(v_suggestion.proposed_phone),'') is not null and
    btrim(v_suggestion.proposed_phone) is distinct from btrim(coalesce(v_coach.phone,''))) or
   (nullif(btrim(v_suggestion.proposed_x_url),'') is not null and
    btrim(v_suggestion.proposed_x_url) is distinct from btrim(coalesce(v_coach.x_url,''))) or
   (v_suggestion.proposed_college_id is not null and v_suggestion.proposed_college_id is distinct from v_coach.college_id) or
   (v_suggestion.suggestion_type='left_program' and v_coach.lifecycle_status<>'departed') or
   (v_suggestion.suggestion_type='retired' and v_coach.lifecycle_status<>'retired') or
   (v_suggestion.suggestion_type='moved_school' and v_suggestion.proposed_college_id is not null and v_coach.lifecycle_status<>'active')
  );
  if not v_has_change then
   raise exception 'No directory changes to apply. Choose Verify Only to close the report without changing coach data';
  end if;
  if nullif(btrim(v_suggestion.proposed_email),'') is not null
   and btrim(v_suggestion.proposed_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then raise exception 'Invalid proposed coach email address'; end if;

  update public.college_coaches set
   first_name=coalesce(nullif(btrim(v_suggestion.proposed_first_name),''),v_coach.first_name),
   last_name=coalesce(nullif(btrim(v_suggestion.proposed_last_name),''),v_coach.last_name),
   title=coalesce(nullif(btrim(v_suggestion.proposed_title),''),v_coach.title),
   email=coalesce(nullif(btrim(v_suggestion.proposed_email),''),v_coach.email),
   phone=coalesce(nullif(btrim(v_suggestion.proposed_phone),''),v_coach.phone),
   x_url=coalesce(nullif(btrim(v_suggestion.proposed_x_url),''),v_coach.x_url),
   previous_college_id=case when v_suggestion.proposed_college_id is not null and
    v_suggestion.proposed_college_id is distinct from v_coach.college_id then v_coach.college_id
    else v_coach.previous_college_id end,
   college_id=coalesce(v_suggestion.proposed_college_id,v_coach.college_id),
   lifecycle_status=case
    when v_suggestion.suggestion_type='left_program' then 'departed'
    when v_suggestion.suggestion_type='retired' then 'retired'
    when v_suggestion.suggestion_type='moved_school' and v_suggestion.proposed_college_id is not null then 'active'
    else v_coach.lifecycle_status end,
   departed_at=case
    when v_suggestion.suggestion_type in ('left_program','retired') then current_date
    when v_suggestion.suggestion_type='moved_school' and v_suggestion.proposed_college_id is not null then null
    else v_coach.departed_at end,
   lifecycle_note=case when v_suggestion.suggestion_type in ('left_program','retired') or
     (v_suggestion.suggestion_type='moved_school' and v_suggestion.proposed_college_id is not null)
    then coalesce(nullif(btrim(v_suggestion.details),''),
      'Community report verified by RLTNL') else v_coach.lifecycle_note end,
   updated_by_user_id=v_actor,updated_at=now(),last_verified_at=now(),
   source_note=right(concat_ws(E'\n',nullif(v_coach.source_note,''),
    'Community suggestion '||v_suggestion.id::text||' verified and applied by RLTNL on '||current_date::text),4000)
  where id=v_coach.id;
  v_status='accepted';
 elsif p_decision='verify_only' then
  -- Record a verified report without touching the canonical coach or relationships.
  v_status='resolved';
 else
  v_status='rejected';
 end if;

 update public.college_coach_update_suggestions set
  status=v_status,reviewed_at=now(),reviewed_by_user_id=v_actor
 where id=v_suggestion.id;

 insert into public.college_coach_suggestion_review_evidence(
  suggestion_id,verification_note,verification_source_url,reviewed_by_user_id,reviewed_at
 ) values(v_suggestion.id,v_review_note,v_source,v_actor,now())
 on conflict(suggestion_id) do update set
  verification_note=excluded.verification_note,
  verification_source_url=excluded.verification_source_url,
  reviewed_by_user_id=excluded.reviewed_by_user_id,
  reviewed_at=excluded.reviewed_at;

 if p_notify then
  if p_decision in ('accept','verify_only') and v_body is null then
   v_body='Thank you for helping keep RLTNL Recruiting''s coach information accurate.'||
    E'\n\nYour submission regarding '||v_name||
    case when v_school is not null then ' at '||v_school else '' end||
    ' ('||v_kind||') has been reviewed and verified. '||
    case when p_decision='accept'
     then 'The verified changes have been applied to our shared coach directory.'
     else 'No changes were made to our shared coach directory.' end||
    E'\n\nWe appreciate your contribution!\n\nRLTNL Support';
   v_automatic=true;
  end if;
  if v_body is not null then
   insert into public.platform_message_threads(
    source_type,source_id,recipient_user_id,created_by_user_id,subject
   ) values(
    'coach_suggestion',v_suggestion.id,v_suggestion.submitted_by_user_id,v_actor,'Coach information: '||v_name
   ) on conflict(source_type,source_id,recipient_user_id)
   do update set updated_at=now()
   returning id into v_thread_id;
   insert into public.platform_message_entries(thread_id,sender_user_id,body,source_url)
    values(v_thread_id,v_actor,v_body,v_message_source);
   update public.platform_message_threads set updated_at=now() where id=v_thread_id;
   v_sent=true;
  end if;
 end if;

 return jsonb_build_object('ok',true,'decision',p_decision,'status',v_status,
  'changes_applied',v_status='accepted','message_sent',v_sent,
  'automatic_message',v_automatic,'thread_id',v_thread_id);
end;
$function$;

revoke all on function public.review_college_coach_suggestion_v2(uuid,text,boolean,text,text,text,text)
 from public,anon;
grant execute on function public.review_college_coach_suggestion_v2(uuid,text,boolean,text,text,text,text)
 to authenticated;
