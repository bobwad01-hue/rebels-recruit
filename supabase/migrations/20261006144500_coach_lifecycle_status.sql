alter table public.college_coaches
 add column if not exists lifecycle_status text not null default 'active',
 add column if not exists departed_at date,
 add column if not exists lifecycle_note text;
alter table public.college_coaches drop constraint if exists college_coaches_lifecycle_status_check;
alter table public.college_coaches add constraint college_coaches_lifecycle_status_check check (lifecycle_status in ('active','departed','retired','inactive'));
create index if not exists college_coaches_college_lifecycle_idx on public.college_coaches(college_id,lifecycle_status);
