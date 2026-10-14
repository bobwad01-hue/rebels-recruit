-- Allow an authenticated Super Owner to manually verify softball staff when the
-- official source blocks automated requests (HTTP 403/robots). This only opens
-- the existing, audited manual-staff quality gate. It never imports coaches.
-- Works for NCAA D1/D2/D3, NAIA and JC without division-specific shortcuts.
create or replace function public.prepare_college_staff_blocked_access_manual_review(
  p_college_id uuid,
  p_user_id uuid,
  p_source_url text,
  p_head_coach_name text,
  p_notes text,
  p_trusted_host boolean,
  p_reuse_saved boolean default false
) returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_status text;
  v_error text;
  v_state text;
  v_saved public.college_staff_source_verifications%rowtype;
  v_staff_url text;
begin
  if not exists (select 1 from public.platform_roles
      where user_id=p_user_id and role='super_owner') then
    raise exception 'Super Owner access required';
  end if;
  perform 1 from public.colleges
    where id=p_college_id and division in ('NCAA D1','NCAA D2','NCAA D3','NAIA','JC')
    for update;
  if not found then raise exception 'Supported college not found'; end if;
  select status,last_error into v_status,v_error
    from public.college_staff_bootstrap_queue
    where college_id=p_college_id for update;
  if v_status is distinct from 'blocked'
     or coalesce(v_error,'') !~* '(403|forbidden|robots|access denied)' then
    raise exception 'Only blocked official-source access cases can enter this manual workflow';
  end if;
  if p_source_url is null or p_source_url not like 'https://%' or not p_trusted_host then
    if p_reuse_saved then
      raise exception 'Saved coaching source is not on an approved school host';
    end if;
  end if;

  if p_reuse_saved then
    select * into v_saved from public.college_staff_source_verifications
      where college_id=p_college_id for update;
    if not found or v_saved.outcome<>'verified'
       or v_saved.source_url is distinct from p_source_url
       or v_saved.recheck_status='host_review' then
      raise exception 'The saved official source changed or is awaiting athletics-host approval';
    end if;
    select staff_url into v_staff_url from public.college_softball_sources
      where college_id=p_college_id for update;
    if v_staff_url is distinct from regexp_replace(p_source_url,'#.*$','') then
      raise exception 'Saved official staff URL does not match the approved source';
    end if;
    v_state:='pending';
  else
    v_state:=public.save_college_staff_source_verification(
      p_college_id,p_user_id,'verified',p_source_url,
      p_head_coach_name,p_notes,p_trusted_host
    );
    -- Unrecognized hosts still require independently evidenced approval.
    if v_state='host_review' then return 'host_review'; end if;
    if v_state<>'pending' then
      raise exception 'Official source verification did not reach manual review';
    end if;
  end if;

  update public.college_staff_bootstrap_queue
    set status='review',
        last_error='Manual verification: official softball staff source blocks automated access; Super Owner must verify each coach',
        updated_at=now()
    where college_id=p_college_id;
  update public.college_staff_source_verifications
    set recheck_status='needs_review',
        recheck_message='Official staff source is independently trusted, but automated access is blocked. Verify each coach name, role and email manually before import.',
        rechecked_at=now(),updated_at=now()
    where college_id=p_college_id;

  return 'needs_review';
end;
$function$;
revoke all on function public.prepare_college_staff_blocked_access_manual_review(uuid,uuid,text,text,text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.prepare_college_staff_blocked_access_manual_review(uuid,uuid,text,text,text,boolean,boolean) to service_role;
