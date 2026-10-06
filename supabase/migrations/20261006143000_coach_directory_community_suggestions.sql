create table if not exists public.college_coach_update_suggestions (
 id uuid primary key default gen_random_uuid(),
 coach_id uuid not null references public.college_coaches(id) on delete cascade,
 submitted_by_user_id uuid not null references auth.users(id) on delete cascade,
 suggestion_type text not null check (suggestion_type in ('contact_update','title_update','left_program','moved_school','retired','incorrect_info','other')),
 details text, proposed_email text, proposed_phone text, proposed_title text, proposed_x_url text,
 proposed_college_id uuid references public.colleges(id) on delete set null,
 status text not null default 'pending' check (status in ('pending','accepted','rejected','resolved')),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 reviewed_by_user_id uuid references auth.users(id) on delete set null
);
alter table public.college_coach_update_suggestions enable row level security;
drop policy if exists "users submit coach suggestions" on public.college_coach_update_suggestions;
create policy "users submit coach suggestions" on public.college_coach_update_suggestions for insert to authenticated with check (submitted_by_user_id=auth.uid());
drop policy if exists "users read own coach suggestions" on public.college_coach_update_suggestions;
create policy "users read own coach suggestions" on public.college_coach_update_suggestions for select to authenticated using (submitted_by_user_id=auth.uid() or exists(select 1 from public.organization_members om where om.user_id=auth.uid() and om.status='active' and om.role in ('owner','admin')));
drop policy if exists "authenticated coach directory update" on public.college_coaches;
