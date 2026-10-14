-- Advisor Communications: assignment-scoped alerts and opt-in daily digest.
-- No change to existing athlete/advisor access policies or assignments.
alter table public.notification_preferences
  add column if not exists advisor_coach_reply_alerts boolean not null default true,
  add column if not exists advisor_email_sent_alerts boolean not null default false,
  add column if not exists advisor_daily_digest boolean not null default false,
  add column if not exists advisor_digest_sent_on date;

create or replace function private.notify_advisors_of_coach_reply()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Do not replay alerts for historical Gmail imports. Only meaningful replies
  -- are pushed; all tracked replies remain visible in Advisor Communications.
  if new.received_at is null or new.received_at < now() - interval '24 hours'
     or not (coalesce(new.action_required, false)
       or coalesce(new.recruiting_intent in ('offer_related','camp_invitation','visit_invitation','call_request','information_request'), false))
  then return new; end if;

  insert into public.notifications (user_id, title, body, kind, url, data, dedupe_key)
  select distinct aa.advisor_user_id,
    'Coach response for ' || coalesce(nullif(trim(p.full_name), ''), 'your athlete'),
    coalesce(col.name || ' · ', '') || coalesce(nullif(trim(concat_ws(' ', cc.first_name, cc.last_name)), ''), 'A college coach') || ' replied. Review the next step in RLTNL.',
    'advisor_coach_reply',
    '/advisors/communications?player=' || new.athlete_user_id::text || '&message=' || coalesce(new.interaction_id, new.id)::text,
    jsonb_build_object('athlete_user_id', new.athlete_user_id, 'gmail_recruiting_message_id', new.id),
    'advisor-coach-reply:' || new.id::text
  from public.athlete_advisor_assignments aa
  left join public.notification_preferences np on np.user_id = aa.advisor_user_id
  left join public.profiles p on p.id = new.athlete_user_id
  left join public.college_coaches cc on cc.id = new.coach_id
  left join public.colleges col on col.id = new.college_id
  where aa.athlete_user_id = new.athlete_user_id
    and aa.status = 'active'
    and coalesce(np.advisor_coach_reply_alerts, true)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists advisor_coach_reply_notification on public.gmail_recruiting_messages;
create trigger advisor_coach_reply_notification
after insert on public.gmail_recruiting_messages
for each row execute function private.notify_advisors_of_coach_reply();

create or replace function private.notify_advisors_of_sent_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.type <> 'Email Sent' or new.source is distinct from 'automatic'
    or new.created_at < now() - interval '24 hours' then return new; end if;
  insert into public.notifications (user_id, title, body, kind, url, data, dedupe_key)
  select distinct aa.advisor_user_id,
    coalesce(nullif(trim(p.full_name), ''), 'Your athlete') || ' emailed a college coach',
    coalesce(col.name || ' · ', '') || coalesce(nullif(trim(concat_ws(' ', cc.first_name, cc.last_name)), ''), 'College coach') || '. See the recruiting activity in RLTNL.',
    'advisor_email_sent',
    '/advisors/communications?player=' || new.athlete_user_id::text || '&message=' || new.id::text,
    jsonb_build_object('athlete_user_id', new.athlete_user_id, 'interaction_id', new.id),
    'advisor-email-sent:' || new.id::text
  from public.athlete_advisor_assignments aa
  left join public.notification_preferences np on np.user_id = aa.advisor_user_id
  left join public.profiles p on p.id = new.athlete_user_id
  left join public.college_coaches cc on cc.id = new.coach_id
  left join public.colleges col on col.id = new.college_id
  where aa.athlete_user_id = new.athlete_user_id
    and aa.status = 'active'
    and aa.advisor_user_id is distinct from new.actor_user_id
    and coalesce(np.advisor_email_sent_alerts, false)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists advisor_email_sent_notification on public.interactions;
create trigger advisor_email_sent_notification
after insert on public.interactions
for each row execute function private.notify_advisors_of_sent_email();
