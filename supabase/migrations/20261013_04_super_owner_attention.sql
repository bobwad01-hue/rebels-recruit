-- Super Owner attention: coach review requests and user feedback.
-- Uses existing notifications + phone push worker; pending counts are derived
-- from source records, so opening an alert never dismisses unfinished work.

alter table public.support_cases
  add column if not exists feedback_type text;
alter table public.support_cases
  drop constraint if exists support_cases_feedback_type_check;
alter table public.support_cases
  add constraint support_cases_feedback_type_check
  check (feedback_type is null or feedback_type in ('broken','confusing','idea','other'));

create index if not exists support_cases_open_feedback_idx
  on public.support_cases (created_at desc)
  where feedback_type is not null and status in ('open','investigating','waiting_on_user');

drop policy if exists support_cases_super_owner_feedback_read on public.support_cases;
create policy support_cases_super_owner_feedback_read on public.support_cases
  for select to authenticated using (
    feedback_type is not null
    and exists (select 1 from public.platform_roles pr
                where pr.user_id=auth.uid() and pr.role='super_owner')
  );
drop policy if exists support_cases_super_owner_feedback_update on public.support_cases;
create policy support_cases_super_owner_feedback_update on public.support_cases
  for update to authenticated using (
    feedback_type is not null
    and exists (select 1 from public.platform_roles pr
                where pr.user_id=auth.uid() and pr.role='super_owner')
  ) with check (
    feedback_type is not null
    and exists (select 1 from public.platform_roles pr
                where pr.user_id=auth.uid() and pr.role='super_owner')
  );

create or replace function public.submit_platform_feedback(
  p_feedback_type text, p_message text, p_page text, p_role text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  case_id uuid;
  label text;
  page_path text;
  role_label text;
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
  role_label:=left(coalesce(p_role,'unknown'),80);

  -- Reuse the established support-case creation and audit workflow.
  case_id:=public.create_support_case('other',
    '['||label||'] '||btrim(p_message)||
    E'\n\nPage: '||page_path||E'\nRole: '||role_label);
  update public.support_cases
  set feedback_type=p_feedback_type,
      diagnostic_snapshot=coalesce(diagnostic_snapshot,'{}'::jsonb)||
        jsonb_build_object('source','feedback','feedback_type',p_feedback_type,
                           'page',page_path,'role',role_label)
  where id=case_id and reporter_user_id=auth.uid();
  if not found then raise exception 'Could not record feedback'; end if;
  return case_id;
end;
$$;
revoke all on function public.submit_platform_feedback(text,text,text,text) from public,anon;
grant execute on function public.submit_platform_feedback(text,text,text,text) to authenticated;

create or replace function private.notify_super_owner_attention()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  alert_title text;
  alert_body text;
  alert_kind text;
  alert_url text;
  alert_data jsonb;
  alert_key text;
begin
  if tg_table_name='college_coach_update_suggestions' then
    if new.status<>'pending' then return new; end if;
    if tg_op='UPDATE' and old.status='pending' then return new; end if;
    alert_title:='Coach information needs review';
    alert_body:='A proposed coach update is waiting for your verification.';
    alert_kind:='platform_review';
    alert_url:='/platform-admin/coach-data-review';
    alert_data:=jsonb_build_object('source','coach_suggestion','id',new.id);
    alert_key:='owner-coach-suggestion:'||new.id::text;
  elsif tg_table_name='college_coach_contact_reviews' then
    if new.status<>'pending' then return new; end if;
    if tg_op='UPDATE' and old.status='pending' then return new; end if;
    alert_title:='Conflicting coach contact details';
    alert_body:='A coach contact field needs independent verification.';
    alert_kind:='platform_review';
    alert_url:='/platform-admin/coach-data-review';
    alert_data:=jsonb_build_object('source','coach_contact_conflict','id',new.id);
    alert_key:='owner-coach-conflict:'||new.id::text;
  elsif tg_table_name='support_cases' then
    if new.feedback_type is null then return new; end if;
    if tg_op='UPDATE' and old.feedback_type is not null then return new; end if;
    alert_title:='New RLTNL feedback';
    alert_body:='A user submitted feedback. Review it in your Feedback Inbox.';
    alert_kind:='platform_feedback';
    alert_url:='/platform-admin/feedback';
    alert_data:=jsonb_build_object('source','feedback','id',new.id);
    alert_key:='owner-feedback:'||new.id::text;
  else
    return new;
  end if;

  insert into public.notifications(user_id,title,body,kind,url,data,dedupe_key)
  select pr.user_id,alert_title,alert_body,alert_kind,alert_url,alert_data,alert_key
  from public.platform_roles pr where pr.role='super_owner'
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists super_owner_coach_suggestion_alert on public.college_coach_update_suggestions;
create trigger super_owner_coach_suggestion_alert
  after insert or update of status on public.college_coach_update_suggestions
  for each row execute function private.notify_super_owner_attention();

drop trigger if exists super_owner_coach_contact_alert on public.college_coach_contact_reviews;
create trigger super_owner_coach_contact_alert
  after insert or update of status on public.college_coach_contact_reviews
  for each row execute function private.notify_super_owner_attention();

drop trigger if exists super_owner_feedback_alert on public.support_cases;
create trigger super_owner_feedback_alert
  after update of feedback_type on public.support_cases
  for each row execute function private.notify_super_owner_attention();
