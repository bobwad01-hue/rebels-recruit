-- Lock recruiting-intelligence staff reads to the same scope as the product UI.
drop policy if exists athlete_preference_signals_staff_read on public.athlete_preference_signals;
create policy athlete_preference_signals_staff_read on public.athlete_preference_signals
for select using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id=athlete_preference_signals.organization_id
      and om.user_id=auth.uid() and om.status='active' and om.role='admin'
  )
  or exists (
    select 1 from public.organization_members om
    join public.athlete_advisor_assignments aaa
      on aaa.organization_id=om.organization_id
     and aaa.advisor_user_id=om.user_id
     and aaa.athlete_user_id=athlete_preference_signals.athlete_user_id
     and aaa.status='active'
    where om.organization_id=athlete_preference_signals.organization_id
      and om.user_id=auth.uid() and om.status='active' and om.role='advisor'
  )
);
drop policy if exists athlete_behavior_events_staff_read on public.athlete_behavior_events;
create policy athlete_behavior_events_staff_read on public.athlete_behavior_events
for select using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id=athlete_behavior_events.organization_id
      and om.user_id=auth.uid() and om.status='active' and om.role='admin'
  )
  or exists (
    select 1 from public.organization_members om
    join public.athlete_advisor_assignments aaa
      on aaa.organization_id=om.organization_id
     and aaa.advisor_user_id=om.user_id
     and aaa.athlete_user_id=athlete_behavior_events.athlete_user_id
     and aaa.status='active'
    where om.organization_id=athlete_behavior_events.organization_id
      and om.user_id=auth.uid() and om.status='active' and om.role='advisor'
  )
);
create index if not exists athlete_preference_signals_org_athlete_idx on public.athlete_preference_signals(organization_id,athlete_user_id,created_at desc);
create index if not exists athlete_behavior_events_org_athlete_idx on public.athlete_behavior_events(organization_id,athlete_user_id,occurred_at desc);