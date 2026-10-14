-- Allow the Super Owner to send a previously saved, personally verified
-- softball coaching URL directly to the existing one-school coaching parser.
-- This does NOT independently approve an athletics domain, and it never
-- imports or approves any coach. The existing worker quality gates decide.
create or replace function public.confirm_college_staff_saved_source_for_validation(
  p_college_id uuid,p_user_id uuid,p_source_url text
) returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_school public.colleges%rowtype;
  v_verification public.college_staff_source_verifications%rowtype;
  v_queue_status text;
  v_host text;
  v_fetch_url text;
begin
  if not exists (select 1 from public.platform_roles
      where user_id=p_user_id and role='super_owner') then
    raise exception 'Super Owner access required';
  end if;
  select * into v_school from public.colleges where id=p_college_id for update;
  if not found or v_school.division not in ('NCAA D1','NCAA D2','NCAA D3','NAIA','JC') then
    raise exception 'Supported college not found';
  end if;
  select status into v_queue_status from public.college_staff_bootstrap_queue
    where college_id=p_college_id for update;
  if v_queue_status is distinct from 'review' then
    raise exception 'Only schools awaiting saved-source review can be validated';
  end if;
  select * into v_verification from public.college_staff_source_verifications
    where college_id=p_college_id for update;
  if not found or v_verification.outcome is distinct from 'verified'
      or v_verification.recheck_status is distinct from 'host_review'
      or v_verification.source_url is distinct from p_source_url
      or v_verification.verified_by_user_id is null then
    raise exception 'Saved owner-verified coaching URL changed; refresh and review it again';
  end if;
  if length(p_source_url)>1500 or p_source_url !~ '^https://[a-zA-Z0-9.-]+(/|\?|#|$)'
      or p_source_url ~ '[[:space:]@]' then
    raise exception 'Saved source must be a public HTTPS coaching URL';
  end if;
  v_host:=lower(regexp_replace(split_part(p_source_url,'/',3),'^www\.',''));
  if v_host !~ '^([a-z0-9-]+\.)+[a-z]{2,}$'
      or v_host ~ '(^|\.)(localhost|local|internal|test|example|invalid)$'
      or v_host ~ '(^|\.)(google\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|youtube\.com|linkedin\.com|tiktok\.com|bit\.ly)$' then
    raise exception 'Saved source host is not an eligible official athletics site';
  end if;
  v_fetch_url:=regexp_replace(p_source_url,'#.*$','');
  insert into public.college_softball_sources(
    college_id,staff_url,staff_navigation_url,status,updated_at
  ) values(p_college_id,v_fetch_url,p_source_url,'review',now())
  on conflict(college_id) do update set
    staff_url=excluded.staff_url,
    staff_navigation_url=excluded.staff_navigation_url,
    status='review',updated_at=now();
  update public.college_staff_bootstrap_queue
    set status='pending',last_error=null,updated_at=now()
    where college_id=p_college_id;
  update public.college_staff_source_verifications
    set recheck_status='pending',
      recheck_message='Saved coaching URL confirmed by Super Owner for direct one-school staff validation. Athletics host not independently university-linked. Coach identities and contacts still require worker quality gates.',
      rechecked_at=null,updated_at=now()
    where college_id=p_college_id;
  insert into public.audit_log(
    organization_id,actor_user_id,action,entity_type,entity_id,metadata
  ) values (
    null,p_user_id,'college_staff_saved_source_direct_validation',
    'college',p_college_id,
    jsonb_build_object('source_url',p_source_url,'host',v_host,
      'verification_by',v_verification.verified_by_user_id,
      'verification_at',v_verification.verified_at,
      'mode','owner_confirmed_saved_source',
      'independent_university_link',false,
      'note','Only this school was queued. No coach record approved by this action.')
  );
  return 'pending';
end;
$function$;
revoke all on function public.confirm_college_staff_saved_source_for_validation(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.confirm_college_staff_saved_source_for_validation(uuid,uuid,text)
  to service_role;
