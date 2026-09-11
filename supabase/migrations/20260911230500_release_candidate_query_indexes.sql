create index if not exists reminders_athlete_status_due_idx
  on public.reminders (athlete_user_id, status, due_date);

create index if not exists parent_guardian_access_parent_status_idx
  on public.parent_guardian_access (parent_user_id, status, created_at);

create index if not exists athlete_advisor_assignments_org_advisor_status_idx
  on public.athlete_advisor_assignments (organization_id, advisor_user_id, status);

create index if not exists athlete_advisor_assignments_org_status_idx
  on public.athlete_advisor_assignments (organization_id, status);

create index if not exists athlete_events_athlete_status_idx
  on public.athlete_events (athlete_user_id, status);
