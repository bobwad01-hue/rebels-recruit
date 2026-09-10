alter table public.reminders add column if not exists event_id uuid references public.events(id) on delete cascade;
alter table public.reminders add column if not exists reminder_kind text not null default 'manual';

create unique index if not exists reminders_unique_event_prearrival_email
on public.reminders(athlete_user_id,event_id,reminder_kind)
where event_id is not null and reminder_kind='event_prearrival_email';

create or replace function public.sync_event_prearrival_email_reminder()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  e public.events%rowtype;
  due_on date;
  reminder_title text;
begin
  select * into e from public.events where id=new.event_id;
  if not found then return new; end if;
  reminder_title := 'Email coaches before ' || coalesce(e.name,'upcoming recruiting event');
  due_on := greatest(current_date, e.date - 2);

  if new.status='going' and e.date >= current_date then
    insert into public.reminders(owner_user_id,athlete_user_id,college_id,event_id,title,due_date,status,reminder_kind)
    values(new.athlete_user_id,new.athlete_user_id,e.college_id,new.event_id,reminder_title,due_on,'open','event_prearrival_email')
    on conflict (athlete_user_id,event_id,reminder_kind)
      where event_id is not null and reminder_kind='event_prearrival_email'
    do update set
      college_id=excluded.college_id,
      title=excluded.title,
      due_date=excluded.due_date,
      status=case when public.reminders.status='completed' then public.reminders.status else 'open' end;
  elsif new.status<>'going' then
    delete from public.reminders
    where athlete_user_id=new.athlete_user_id
      and event_id=new.event_id
      and reminder_kind='event_prearrival_email'
      and status<>'completed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_event_prearrival_email_reminder on public.athlete_events;
create trigger trg_sync_event_prearrival_email_reminder
after insert or update of status on public.athlete_events
for each row execute function public.sync_event_prearrival_email_reminder();

insert into public.reminders(owner_user_id,athlete_user_id,college_id,event_id,title,due_date,status,reminder_kind)
select ae.athlete_user_id,ae.athlete_user_id,e.college_id,e.id,
       'Email coaches before '||coalesce(e.name,'upcoming recruiting event'),
       greatest(current_date,e.date-2),'open','event_prearrival_email'
from public.athlete_events ae
join public.events e on e.id=ae.event_id
where ae.status='going' and e.date>=current_date
on conflict (athlete_user_id,event_id,reminder_kind)
  where event_id is not null and reminder_kind='event_prearrival_email'
do nothing;
