-- Guard INSERT trigger access to OLD and notify again if a coach review is reopened.
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
    if tg_op='UPDATE' then
      if old.status='pending' then return new; end if;
    end if;
    alert_title:='Coach information needs review';
    alert_body:='A proposed coach update is waiting for your verification.';
    alert_kind:='platform_review';
    alert_url:='/platform-admin/coach-data-review';
    alert_data:=jsonb_build_object('source','coach_suggestion','id',new.id);
    alert_key:='owner-coach-suggestion:'||new.id::text||case when tg_op='UPDATE' then ':reopened:'||txid_current()::text else '' end;
  elsif tg_table_name='college_coach_contact_reviews' then
    if new.status<>'pending' then return new; end if;
    if tg_op='UPDATE' then
      if old.status='pending' then return new; end if;
    end if;
    alert_title:='Conflicting coach contact details';
    alert_body:='A coach contact field needs independent verification.';
    alert_kind:='platform_review';
    alert_url:='/platform-admin/coach-data-review';
    alert_data:=jsonb_build_object('source','coach_contact_conflict','id',new.id);
    alert_key:='owner-coach-conflict:'||new.id::text||case when tg_op='UPDATE' then ':reopened:'||txid_current()::text else '' end;
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

