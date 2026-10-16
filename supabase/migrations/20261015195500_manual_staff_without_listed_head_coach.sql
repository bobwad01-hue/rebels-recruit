-- Structured, manually verified softball staff import for schools where the
-- conservative parser has failed. This is a separate, audited human evidence
-- path, not a relaxation of automated identity/contact quality gates.
create or replace function public.import_manually_verified_college_softball_staff(
  p_college_id uuid, p_user_id uuid, p_source_url text, p_coaches jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_verification public.college_staff_source_verifications%rowtype;
  v_queue public.college_staff_bootstrap_queue%rowtype;
  v_source text;
  v_item jsonb;
  v_name text;
  v_key text;
  v_first text;
  v_last text;
  v_title text;
  v_email text;
  v_role text;
  v_existing public.college_coaches%rowtype;
  v_coach_id uuid;
  v_count integer;
  v_head_count integer := 0;
  v_confirmed_head_name text;
  v_no_head_coach_listed boolean := false;
  v_imported integer := 0;
  v_updated integer := 0;
  v_seen text[] := array[]::text[];
  v_now timestamptz := now();
begin
  if not exists (select 1 from public.platform_roles
                 where user_id=p_user_id and role='super_owner') then
    raise exception 'Super Owner access required';
  end if;
  if p_coaches is null or jsonb_typeof(p_coaches)<>'array' then
    raise exception 'Provide a structured coaching staff list';
  end if;
  v_count := jsonb_array_length(p_coaches);
  if v_count<1 or v_count>8 then
    raise exception 'Manual staff review requires between one and eight coaches';
  end if;
  select * into v_queue from public.college_staff_bootstrap_queue
    where college_id=p_college_id for update;
  if not found or v_queue.status<>'review' then
    raise exception 'School must still be in review before manual staff import';
  end if;
  select * into v_verification from public.college_staff_source_verifications
    where college_id=p_college_id for update;
  if not found or v_verification.outcome<>'verified'
     or v_verification.recheck_status<>'needs_review'
     or v_verification.source_url is distinct from p_source_url then
    raise exception 'First save and confirm the exact official source; a failed parser recheck is required';
  end if;
  select staff_url into v_source from public.college_softball_sources
    where college_id=p_college_id for update;
  if v_source is null or v_source<>regexp_replace(p_source_url,'#.*$','') then
    raise exception 'Saved official coaching URL no longer matches the verified source';
  end if;

  -- Validate the entire human-supplied roster before writing any coach.
  for v_item in select value from jsonb_array_elements(p_coaches) loop
    if jsonb_typeof(v_item)<>'object' then raise exception 'Invalid coach entry'; end if;
    v_name := btrim(coalesce(v_item->>'name',''));
    v_title := btrim(coalesce(v_item->>'title',''));
    v_role := btrim(coalesce(v_item->>'role',''));
    v_email := nullif(lower(btrim(coalesce(v_item->>'email',''))),'');
    if length(v_name)<5 or length(v_name)>120
       or v_name !~ '^[[:alpha:]][[:alpha:].''’ -]*[[:space:]][[:alpha:]][[:alpha:].''’ -]*$'
       or v_name ~ '[[:cntrl:]]' then
      raise exception 'Enter each coach first and last name exactly as shown on the official page';
    end if;
    if length(v_title)<4 or length(v_title)>120 or v_title ~ '[[:cntrl:]]'
       or v_title !~* '(softball|coach|assistant|pitching|hitting)' then
      raise exception 'Enter the official softball coaching title for %',v_name;
    end if;
    if v_role not in ('head_coach','associate_head_coach','assistant_coach',
       'recruiting_coordinator','pitching_coach','hitting_coach',
       'graduate_assistant','volunteer_assistant','other_coaching_staff') then
      raise exception 'Select a supported coaching role for %',v_name;
    end if;
    if v_email is not null and (length(v_email)>254 or
       v_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$') then
      raise exception 'Invalid official email for %',v_name;
    end if;
    if coalesce((v_item->>'email_domain_exception')::boolean,false)
       and (v_email is null or v_item->>'email_source_confirmed' is distinct from 'true') then
      raise exception 'Confirm the off-domain email on the official staff page for %',v_name;
    end if;
    v_key := regexp_replace(lower(v_name),'[^[:alnum:]]','','g');
    if v_key=any(v_seen) then raise exception 'Duplicate coach: %',v_name; end if;
    v_seen := array_append(v_seen,v_key);
    if v_role='head_coach' then
      v_head_count:=v_head_count+1;
      v_confirmed_head_name:=v_name;
    end if;
  end loop;
  if v_head_count=0 then
    if not coalesce((select bool_and(coalesce((entry.value->>'no_head_coach_listed_confirmed')::boolean,false))
      from jsonb_array_elements(p_coaches) as entry(value)),false) then
      raise exception 'Confirm that no head coach is listed on the official softball staff page';
    end if;
    v_no_head_coach_listed := true;
  elsif v_head_count>1 then
    raise exception 'Multiple head coaches require separate review';
  elsif exists(select 1 from jsonb_array_elements(p_coaches) as entry(value)
      where coalesce((entry.value->>'no_head_coach_listed_confirmed')::boolean,false)) then
    raise exception 'Cannot confirm no head coach when a head coach is in the reviewed staff';
  end if;
  if not v_no_head_coach_listed and v_verification.head_coach_name is not null and btrim(v_verification.head_coach_name)<>'' and
     not exists (select 1 from jsonb_array_elements(p_coaches) as item(value)
       where item.value->>'role'='head_coach' and
       regexp_replace(lower(item.value->>'name'),'[^[:alnum:]]','','g')=
       regexp_replace(lower(v_verification.head_coach_name),'[^[:alnum:]]','','g'))
     and not exists (select 1 from jsonb_array_elements(p_coaches) as item(value)
       where item.value->>'role'='head_coach'
         and item.value->>'head_coach_override_confirmed'='true') then
    raise exception 'Saved head coach differs from the official page; explicitly confirm the replacement head coach';
  end if;

  for v_item in select value from jsonb_array_elements(p_coaches) loop
    v_name:=btrim(v_item->>'name');
    v_first:=split_part(v_name,' ',1);
    v_last:=btrim(substr(v_name,length(v_first)+2));
    v_title:=btrim(v_item->>'title');
    v_role:=btrim(v_item->>'role');
    v_email:=nullif(lower(btrim(coalesce(v_item->>'email',''))),'');
    if (select count(*) from public.college_coaches
        where college_id=p_college_id and lifecycle_status='active'
        and lower(btrim(first_name))=lower(v_first)
        and lower(btrim(last_name))=lower(v_last))>1 then
      raise exception 'Duplicate active identity for %; manual contact review required',v_name;
    end if;
    select * into v_existing from public.college_coaches
      where college_id=p_college_id and lifecycle_status='active'
        and lower(btrim(first_name))=lower(v_first)
        and lower(btrim(last_name))=lower(v_last)
      order by verification_confidence desc nulls last limit 1 for update;
    if found and v_existing.role_category is not null
       and v_existing.role_category<>v_role then
      raise exception 'Existing coaching role conflicts for %; do not overwrite it automatically',v_name;
    end if;
    if v_email is not null and exists(
      select 1 from public.college_coaches
       where college_id=p_college_id and lifecycle_status='active'
         and lower(email)=v_email
         and (lower(btrim(first_name))<>lower(v_first)
           or lower(btrim(last_name))<>lower(v_last))) then
      raise exception 'Email already belongs to a different active coach: %',v_email;
    end if;
    if v_existing.id is null then
      insert into public.college_coaches(
        college_id,first_name,last_name,title,email,role_category,
        staff_sort_order,official_source_url,official_source_checked_at,
        official_source_status,verification_status,verification_confidence,
        source_urls,source_note,updated_by_user_id,lifecycle_status
      ) values (
        p_college_id,v_first,v_last,v_title,v_email,v_role,
        case when v_role='head_coach' then 0 else 20 end,
        v_source,v_now,'high_confidence','high_confidence',0.98,
        array[v_source], 'Super Owner verified softball staff on the official source; manual parser exception',p_user_id,'active'
      ) returning id into v_coach_id;
      v_imported:=v_imported+1;
    else
      v_coach_id:=v_existing.id;
      if v_email is not null and v_existing.email is not null and
         lower(btrim(v_existing.email))<>v_email then
        insert into public.college_coach_contact_reviews(coach_id,field_name,observed_values,status)
        values(v_coach_id,'email',array[v_existing.email,v_email],'pending')
        on conflict(coach_id,field_name) do update set
          observed_values=excluded.observed_values,status='pending';
      end if;
      update public.college_coaches set
        title=coalesce(nullif(title,''),v_title),
        email=coalesce(nullif(email,''),v_email),
        role_category=coalesce(role_category,v_role),
        staff_sort_order=coalesce(staff_sort_order,case when v_role='head_coach' then 0 else 20 end),
        official_source_url=v_source,official_source_checked_at=v_now,
        source_urls=case when v_source=any(source_urls) then source_urls else array_append(source_urls,v_source) end,
        contact_verification_needed=contact_verification_needed or
          (v_email is not null and email is not null and lower(btrim(email))<>v_email),
        updated_by_user_id=p_user_id,updated_at=v_now
      where id=v_coach_id;
      v_updated:=v_updated+1;
    end if;
    insert into public.college_coach_source_snapshots(
      college_id,coach_id,source_url,observed_name,observed_title,observed_email,
      confidence,verification_status,raw_evidence
    ) values (
      p_college_id,v_coach_id,v_source,v_name,v_title,v_email,
      0.98,'high_confidence',
      jsonb_build_object('official_source',true,'method','super_owner_manual_staff_review',
        'source_verification_at',v_verification.verified_at,
        'verified_by_user_id',p_user_id,'manual_parser_exception',true,
        'email_domain_exception',coalesce((v_item->>'email_domain_exception')::boolean,false),
        'email_confirmed_on_official_source',coalesce((v_item->>'email_source_confirmed')::boolean,false),
        'email_evidence_method',case when coalesce((v_item->>'email_domain_exception')::boolean,false)
          then 'super_owner_explicit_official_page_attestation' else null end,
        'email_evidence_url',case when coalesce((v_item->>'email_domain_exception')::boolean,false)
          then v_source else null end,
        'email_evidence_verified_at',case when coalesce((v_item->>'email_domain_exception')::boolean,false)
          then v_now else null end,
        'head_coach_override_confirmed',case when v_role='head_coach'
          then coalesce((v_item->>'head_coach_override_confirmed')::boolean,false) else false end,
        'previous_verified_head_coach_name',case
          when v_no_head_coach_listed then v_verification.head_coach_name
          when v_role='head_coach'
            and regexp_replace(lower(coalesce(v_verification.head_coach_name,'')),'[^[:alnum:]]','','g')
              <> regexp_replace(lower(v_name),'[^[:alnum:]]','','g')
            then v_verification.head_coach_name else null end,
        'head_coach_not_listed_on_official_page',v_no_head_coach_listed,
        'head_coach_absence_verified_by_user_id',case when v_no_head_coach_listed then p_user_id else null end,
        'head_coach_absence_verified_at',case when v_no_head_coach_listed then v_now else null end,
        'head_coach_absence_official_source_url',case when v_no_head_coach_listed then v_source else null end)
    );
  end loop;

  update public.college_staff_bootstrap_queue
    set status='imported',last_error=null,updated_at=v_now
    where college_id=p_college_id and status='review';
  update public.college_softball_sources
    set status='healthy',last_success_at=v_now,updated_at=v_now
    where college_id=p_college_id;
  update public.college_staff_source_verifications
    set recheck_status='passed',head_coach_name=v_confirmed_head_name,recheck_message=
      case when v_no_head_coach_listed then
        'Super Owner manually verified '||v_count||' currently listed softball coaches; no head coach is listed on the official page. Head coach follow-up required.'
      else
        'Super Owner manually verified '||v_count||' coaches on the official source after parser quality gate review'
      end,
      rechecked_at=v_now,updated_at=v_now
    where college_id=p_college_id;
  return jsonb_build_object('status','imported','coaches',v_count,
    'created',v_imported,'updated',v_updated,
    'head_coach_listed',not v_no_head_coach_listed,
    'head_coach_follow_up_required',v_no_head_coach_listed);
end;
$$;
revoke all on function public.import_manually_verified_college_softball_staff(uuid,uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.import_manually_verified_college_softball_staff(uuid,uuid,text,jsonb)
  to service_role;