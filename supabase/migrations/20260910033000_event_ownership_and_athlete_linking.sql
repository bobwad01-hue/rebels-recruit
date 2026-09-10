alter table public.events
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_events_created_by_user_id
  on public.events(created_by_user_id);

create or replace function public.set_event_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by_user_id is null then
    new.created_by_user_id := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.after_athlete_created_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  org_id uuid;
begin
  select app_role into actor_role
  from public.profiles
  where id = new.created_by_user_id;

  if new.created_by_user_id is not null and actor_role = 'athlete' then
    insert into public.athlete_events (athlete_user_id,event_id,status)
    values (new.created_by_user_id,new.id,'considering')
    on conflict (athlete_user_id,event_id) do nothing;

    if new.type in ('College Camp','Campus Visit','Showcase') then
      select organization_id into org_id
      from public.organization_members
      where user_id = new.created_by_user_id
        and status = 'active'
      limit 1;

      insert into public.audit_log (
        organization_id,actor_user_id,action,entity_type,entity_id,metadata
      )
      values (
        org_id,
        new.created_by_user_id,
        'event_added',
        'recruiting_journey',
        new.id,
        jsonb_build_object(
          'stage','Visit/Camp',
          'college_id',new.college_id,
          'milestone_date',new.date,
          'note',new.name,
          'event_id',new.id,
          'source','athlete_event'
        )
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_event_creator on public.events;
create trigger trg_set_event_creator
before insert on public.events
for each row execute function public.set_event_creator();

drop trigger if exists trg_after_athlete_created_event on public.events;
create trigger trg_after_athlete_created_event
after insert on public.events
for each row execute function public.after_athlete_created_event();
