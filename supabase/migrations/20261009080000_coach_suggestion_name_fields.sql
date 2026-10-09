alter table public.college_coach_update_suggestions
  add column if not exists proposed_first_name text,
  add column if not exists proposed_last_name text;
