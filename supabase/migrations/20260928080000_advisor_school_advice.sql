create table if not exists public.advisor_school_advice (
  id uuid primary key default gen_random_uuid(),
  advisor_user_id uuid not null references auth.users(id) on delete cascade,
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  advice text not null check (advice in ('consider','pass')),
  note text,
  athlete_response text check (athlete_response in ('added','passed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(advisor_user_id, athlete_user_id, college_id)
);
create index if not exists advisor_school_advice_athlete_college_idx on public.advisor_school_advice(athlete_user_id,college_id);
create index if not exists advisor_school_advice_advisor_athlete_idx on public.advisor_school_advice(advisor_user_id,athlete_user_id);
alter table public.advisor_school_advice enable row level security;
create policy advisor_school_advice_select on public.advisor_school_advice for select to authenticated using (advisor_user_id=auth.uid() or athlete_user_id=auth.uid() or public.can_access_athlete(athlete_user_id));
create policy advisor_school_advice_insert on public.advisor_school_advice for insert to authenticated with check (advisor_user_id=auth.uid() and (exists(select 1 from public.athlete_advisor_assignments aaa where aaa.advisor_user_id=auth.uid() and aaa.athlete_user_id=advisor_school_advice.athlete_user_id and aaa.status='active') or exists(select 1 from public.organization_members staff join public.organization_members athlete on athlete.organization_id=staff.organization_id where staff.user_id=auth.uid() and staff.status='active' and staff.role in ('advisor','admin') and coalesce(staff.organization_view_access,false)=true and athlete.user_id=advisor_school_advice.athlete_user_id and athlete.status='active' and athlete.role='athlete')));
create policy advisor_school_advice_update on public.advisor_school_advice for update to authenticated using (advisor_user_id=auth.uid() or athlete_user_id=auth.uid()) with check ((advisor_user_id=auth.uid() and (exists(select 1 from public.athlete_advisor_assignments aaa where aaa.advisor_user_id=auth.uid() and aaa.athlete_user_id=advisor_school_advice.athlete_user_id and aaa.status='active') or exists(select 1 from public.organization_members staff join public.organization_members athlete on athlete.organization_id=staff.organization_id where staff.user_id=auth.uid() and staff.status='active' and staff.role in ('advisor','admin') and coalesce(staff.organization_view_access,false)=true and athlete.user_id=advisor_school_advice.athlete_user_id and athlete.status='active' and athlete.role='athlete'))) or athlete_user_id=auth.uid());
create policy advisor_school_advice_delete on public.advisor_school_advice for delete to authenticated using(advisor_user_id=auth.uid());