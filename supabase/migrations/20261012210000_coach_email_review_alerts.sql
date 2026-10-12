-- Existing messages are initially reviewed. New synced coach emails require review.
alter table public.gmail_recruiting_messages add column if not exists reviewed_at timestamptz default now();
alter table public.gmail_recruiting_messages alter column reviewed_at drop default;
create index if not exists gmail_recruiting_unreviewed_by_athlete_idx on public.gmail_recruiting_messages (athlete_user_id,received_at desc) where reviewed_at is null;
alter table public.notification_preferences add column if not exists coach_emails boolean not null default true;

create or replace function private.queue_coach_email_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare coach_name text; school_name text;
begin
 if new.received_at is null or new.received_at < now()-interval '24 hours' then return new; end if;
 select nullif(trim(concat_ws(' ',c.first_name,c.last_name)),''),col.name into coach_name,school_name
 from public.college_coaches c left join public.colleges col on col.id=c.college_id where c.id=new.coach_id;
 insert into public.notifications (user_id,title,body,kind,url,data,dedupe_key)
 values(new.athlete_user_id,'New email from '||coalesce(coach_name,'a college coach'),
 coalesce(school_name||': ','')||'You have a recruiting email to review.','coach_email',
 '/coaches/'||new.coach_id::text||'?email='||new.id::text,
 jsonb_build_object('gmail_recruiting_message_id',new.id,'coach_id',new.coach_id),
 'coach-email:'||new.athlete_user_id::text||':'||new.gmail_message_id)
 on conflict do nothing;
 return new;
end;$$;
drop trigger if exists gmail_recruiting_coach_email_alert on public.gmail_recruiting_messages;
create trigger gmail_recruiting_coach_email_alert after insert on public.gmail_recruiting_messages
 for each row execute function private.queue_coach_email_notification();
