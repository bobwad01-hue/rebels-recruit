create table if not exists public.organization_recruiting_history (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 athlete_name text not null,
 graduation_year integer,
 position text,
 team_name text,
 college_id uuid not null references public.colleges(id) on delete restrict,
 college_coach_id uuid references public.college_coaches(id) on delete set null,
 college_coach_name text,
 organization_advisor_name text,
 placement_type text not null default 'Committed',
 commitment_year integer,
 notes text,
 source text not null default 'admin_entry',
 source_file_name text,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint organization_recruiting_history_grad_year check (graduation_year is null or graduation_year between 1980 and 2200),
 constraint organization_recruiting_history_commit_year check (commitment_year is null or commitment_year between 1980 and 2200)
);
create index if not exists org_recruiting_history_org_idx on public.organization_recruiting_history(organization_id,graduation_year desc);
create index if not exists org_recruiting_history_college_idx on public.organization_recruiting_history(organization_id,college_id);
alter table public.organization_recruiting_history enable row level security;
drop policy if exists org_recruiting_history_staff_read on public.organization_recruiting_history;
create policy org_recruiting_history_staff_read on public.organization_recruiting_history for select using (
 exists(select 1 from public.organization_members om where om.organization_id=organization_recruiting_history.organization_id and om.user_id=auth.uid() and om.status='active' and om.role in ('admin','advisor'))
);
drop policy if exists org_recruiting_history_admin_insert on public.organization_recruiting_history;
create policy org_recruiting_history_admin_insert on public.organization_recruiting_history for insert with check (
 created_by=auth.uid() and exists(select 1 from public.organization_members om where om.organization_id=organization_recruiting_history.organization_id and om.user_id=auth.uid() and om.status='active' and om.role='admin')
);
drop policy if exists org_recruiting_history_admin_update on public.organization_recruiting_history;
create policy org_recruiting_history_admin_update on public.organization_recruiting_history for update using (
 exists(select 1 from public.organization_members om where om.organization_id=organization_recruiting_history.organization_id and om.user_id=auth.uid() and om.status='active' and om.role='admin')
) with check (
 exists(select 1 from public.organization_members om where om.organization_id=organization_recruiting_history.organization_id and om.user_id=auth.uid() and om.status='active' and om.role='admin')
);
drop policy if exists org_recruiting_history_admin_delete on public.organization_recruiting_history;
create policy org_recruiting_history_admin_delete on public.organization_recruiting_history for delete using (
 exists(select 1 from public.organization_members om where om.organization_id=organization_recruiting_history.organization_id and om.user_id=auth.uid() and om.status='active' and om.role='admin')
);