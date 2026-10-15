-- Keep athlete-provided coach email addresses on their own recruiting
-- relationships, never on the globally shared canonical coach record.
alter table public.athlete_coaches
  add column if not exists email_override text,
  add column if not exists email_override_updated_at timestamptz;

alter table public.athlete_coaches
  drop constraint if exists athlete_coaches_email_override_format_check;
alter table public.athlete_coaches
  add constraint athlete_coaches_email_override_format_check
  check (
    email_override is null or
    (length(email_override) between 3 and 254
     and email_override = btrim(email_override)
     and email_override !~ '[[:space:][:cntrl:]]'
     and email_override ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$')
  );

comment on column public.athlete_coaches.email_override is
  'Athlete-relationship-specific email address supplied for outreach when canonical coach email is missing. Never automatically copy to college_coaches.email or claim official verification.';
comment on column public.athlete_coaches.email_override_updated_at is
  'Time the athlete-scoped unverified email address was last saved.';
