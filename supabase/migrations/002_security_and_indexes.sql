create index if not exists idx_athlete_colleges_athlete on public.athlete_colleges(athlete_user_id);
create index if not exists idx_interactions_athlete_date on public.interactions(athlete_user_id,date desc);
create index if not exists idx_reminders_owner_due on public.reminders(owner_user_id,due_date);
create index if not exists idx_members_user_org on public.organization_members(user_id,organization_id);
create index if not exists idx_assignments_advisor on public.athlete_advisor_assignments(advisor_user_id);
create index if not exists idx_assignments_athlete on public.athlete_advisor_assignments(athlete_user_id);
