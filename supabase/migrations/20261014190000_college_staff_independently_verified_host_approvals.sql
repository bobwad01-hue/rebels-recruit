-- Per-school official athletics host approvals. Approval requires an independently
-- fetched direct link from the school's canonical university website, followed
-- by an explicit Super Owner action. Never infer cross-school trust.
create table if not exists public.college_staff_approved_hosts (
  college_id uuid not null references public.colleges(id) on delete cascade,
  host text not null check (length(host) between 4 and 253),
  evidence_url text not null,
  matched_link text not null,
  source_url_at_approval text not null,
  approved_by_user_id uuid not null,
  approved_at timestamptz not null default now(),
  primary key (college_id,host)
);
create table if not exists public.college_staff_host_approval_events (
  id bigint generated always as identity primary key,
  college_id uuid not null references public.colleges(id) on delete cascade,
  host text not null,
  evidence_url text not null,
  matched_link text not null,
  source_url text not null,
  approved_by_user_id uuid not null,
  approved_at timestamptz not null default now()
);
create index if not exists college_staff_host_approval_events_college_time
  on public.college_staff_host_approval_events(college_id,approved_at desc);
alter table public.college_staff_approved_hosts enable row level security;
alter table public.college_staff_host_approval_events enable row level security;
revoke all on public.college_staff_approved_hosts from public,anon,authenticated;
revoke all on public.college_staff_host_approval_events from public,anon,authenticated;
grant select,insert on public.college_staff_approved_hosts to service_role;
grant select,insert on public.college_staff_host_approval_events to service_role;

create or replace function public.approve_college_staff_official_host(
  p_college_id uuid,p_user_id uuid,p_source_url text,p_host text,
  p_evidence_url text,p_matched_link text
) returns text
language plpgsql security definer set search_path=public
as $$
declare
  v_verification public.college_staff_source_verifications%rowtype;
  v_queue_status text;
  v_host text;
  v_fetch_url text;
begin
  if not exists(select 1 from public.platform_roles
    where user_id=p_user_id and role='super_owner') then
    raise exception 'Super Owner access required';
  end if;
  perform 1 from public.colleges where id=p_college_id for update;
  if not found then raise exception 'College not found'; end if;
  select status into v_queue_status from public.college_staff_bootstrap_queue
    where college_id=p_college_id for update;
  if v_queue_status is distinct from 'review' then
    raise exception 'Only review schools can receive official-host approval';
  end if;
  select * into v_verification from public.college_staff_source_verifications
    where college_id=p_college_id for update;
  if not found or v_verification.outcome<>'verified'
    or v_verification.recheck_status<>'host_review'
    or v_verification.source_url is distinct from p_source_url then
    raise exception 'Source verification changed. Refresh the school before approving';
  end if;
  v_host:=lower(regexp_replace(split_part(p_source_url,'/',3),'^www\.',''));
  if v_host is distinct from p_host
     or v_host !~ '^([a-z0-9-]+\.)+[a-z]{2,}$'
     or p_source_url not like 'https://%'
     or p_evidence_url not like 'https://%'
     or p_matched_link not like 'https://%'
     or length(p_evidence_url)>1500 or length(p_matched_link)>1500 then
    raise exception 'Official host evidence is invalid';
  end if;
  v_fetch_url:=regexp_replace(p_source_url,'#.*$','');
  insert into public.college_staff_approved_hosts(
    college_id,host,evidence_url,matched_link,source_url_at_approval,approved_by_user_id
  ) values(p_college_id,p_host,p_evidence_url,p_matched_link,p_source_url,p_user_id)
  on conflict(college_id,host) do nothing;
  insert into public.college_staff_host_approval_events(
    college_id,host,evidence_url,matched_link,source_url,approved_by_user_id
  ) values(p_college_id,p_host,p_evidence_url,p_matched_link,p_source_url,p_user_id);
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
    set recheck_status='pending',recheck_message=
      'Official athletics domain independently linked from the university site and approved by Super Owner. Targeted coaching quality recheck pending.',
      rechecked_at=null,updated_at=now()
    where college_id=p_college_id;
  return 'pending';
end;
$$;
revoke all on function public.approve_college_staff_official_host(uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.approve_college_staff_official_host(uuid,uuid,text,text,text,text)
  to service_role;