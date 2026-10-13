-- Correct platform feedback role attribution and preserve every subsequent
-- feedback state/notes change as an append-only activity trail.

create table if not exists public.feedback_case_events (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.support_cases(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null,
 event_type text not null check (event_type in ('submitted','status_changed','note_updated','resolution_imported')),
 previous_status text,
 new_status text,
 note text,
 occurred_at timestamptz not null default now()
);
create index if not exists feedback_case_events_case_time_idx
 on public.feedback_case_events(case_id,occurred_at desc,id desc);

alter table public.feedback_case_events enable row level security;
drop policy if exists feedback_case_events_owner_read on public.feedback_case_events;
create policy feedback_case_events_owner_read on public.feedback_case_events
 for select to authenticated using (
  exists(select 1 from public.platform_roles pr
         where pr.user_id=auth.uid() and pr.role='super_owner')
 );

create or replace function private.track_platform_feedback_history()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.feedback_type is null then return new; end if;
 if tg_op='INSERT' then
  insert into public.feedback_case_events(case_id,actor_user_id,event_type,new_status,occurred_at)
  values(new.id,new.reporter_user_id,'submitted',new.status,new.created_at);
 elsif old.feedback_type is null then
  insert into public.feedback_case_events(case_id,actor_user_id,event_type,new_status,occurred_at)
  values(new.id,new.reporter_user_id,'submitted',new.status,new.created_at);
 elsif new.status is distinct from old.status or new.resolution_note is distinct from old.resolution_note then
  insert into public.feedback_case_events(case_id,actor_user_id,event_type,previous_status,new_status,note)
  values(new.id,coalesce(auth.uid(),new.resolved_by_user_id),
   case when new.status is distinct from old.status then 'status_changed' else 'note_updated' end,
   old.status,new.status,new.resolution_note);
 end if;
 return new;
end;
$$;
drop trigger if exists platform_feedback_history on public.support_cases;
create trigger platform_feedback_history
 after insert or update of feedback_type,status,resolution_note on public.support_cases
 for each row execute function private.track_platform_feedback_history();

-- The existing feedback records predate this event log. Preserve what we know,
-- without inventing an earlier transition or reviewer.
insert into public.feedback_case_events(case_id,actor_user_id,event_type,new_status,occurred_at)
select sc.id,sc.reporter_user_id,'submitted','open',sc.created_at
from public.support_cases sc
where sc.feedback_type is not null
and not exists(select 1 from public.feedback_case_events e where e.case_id=sc.id and e.event_type='submitted');

insert into public.feedback_case_events(case_id,actor_user_id,event_type,new_status,note,occurred_at)
select sc.id,sc.resolved_by_user_id,'resolution_imported',sc.status,sc.resolution_note,
       coalesce(sc.resolved_at,sc.updated_at)
from public.support_cases sc
where sc.feedback_type is not null and sc.status in ('resolved','closed')
and not exists(select 1 from public.feedback_case_events e where e.case_id=sc.id and e.event_type='resolution_imported');

create or replace function public.submit_platform_feedback(
 p_feedback_type text,p_message text,p_page text,p_role text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 case_id uuid;
 label text;
 page_path text;
 role_label text;
 account_label text;
 base_role text;
 is_super_owner boolean;
begin
 if auth.uid() is null then raise exception 'Sign in to send feedback'; end if;
 if p_feedback_type not in ('broken','confusing','idea','other') then
  raise exception 'Choose a feedback category';
 end if;
 if length(btrim(coalesce(p_message,''))) < 3 or length(btrim(p_message)) > 4000 then
  raise exception 'Feedback must be between 3 and 4000 characters';
 end if;
 label:=case p_feedback_type
  when 'broken' then 'Something isn''t working'
  when 'confusing' then 'Something is confusing'
  when 'idea' then 'I have an idea'
  else 'Other' end;
 page_path:=case when left(coalesce(p_page,''),1)='/' then left(p_page,400) else '/' end;
 select exists(select 1 from public.platform_roles pr
               where pr.user_id=auth.uid() and pr.role='super_owner')
 into is_super_owner;
 select app_role into base_role from public.profiles where id=auth.uid();
 account_label:=case when is_super_owner then 'Super Owner'
                     else initcap(replace(coalesce(base_role,'user'),'_',' ')) end;
 role_label:=case
  when is_super_owner and (page_path='/platform-admin' or page_path like '/platform-admin/%'
                           or page_path='/owner-preview' or page_path like '/owner-preview/%')
   then 'Super Owner'
  when btrim(coalesce(p_role,''))='Super Owner' and not is_super_owner then account_label
  when length(btrim(coalesce(p_role,''))) between 1 and 80 then btrim(p_role)
  else account_label end;

 case_id:=public.create_support_case('other',
  '['||label||'] '||btrim(p_message)||
  E'\n\nPage: '||page_path||E'\nRole: '||role_label);
 update public.support_cases
 set feedback_type=p_feedback_type,
     diagnostic_snapshot=coalesce(diagnostic_snapshot,'{}'::jsonb)||
      jsonb_build_object('source','feedback','feedback_type',p_feedback_type,
       'page',page_path,'role',role_label,'account_role',account_label)
 where id=case_id and reporter_user_id=auth.uid();
 if not found then raise exception 'Could not record feedback'; end if;
 return case_id;
end;
$$;
revoke all on function public.submit_platform_feedback(text,text,text,text) from public,anon;
grant execute on function public.submit_platform_feedback(text,text,text,text) to authenticated;

-- Correct earlier submissions from actual Super Owners on Platform Admin
-- (including the verified October 13 test), without changing the message.
update public.support_cases sc
set diagnostic_snapshot=coalesce(sc.diagnostic_snapshot,'{}'::jsonb)||
 jsonb_build_object('role','Super Owner','account_role','Super Owner'),
 description=regexp_replace(sc.description,E'\nRole: [^\n]*$',E'\nRole: Super Owner')
where sc.feedback_type is not null
 and (sc.diagnostic_snapshot->>'page'='/platform-admin'
      or sc.diagnostic_snapshot->>'page' like '/platform-admin/%')
 and exists(select 1 from public.platform_roles pr
            where pr.user_id=sc.reporter_user_id and pr.role='super_owner')
 and coalesce(sc.diagnostic_snapshot->>'role','')<>'Super Owner';
