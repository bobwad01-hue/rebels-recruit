alter table public.teams add column if not exists age_group text;

update public.teams
set age_group = case
  when lower(name) ~ '(^|[^0-9])14([^0-9]|$)' then '14U'
  when lower(name) ~ '(^|[^0-9])16([^0-9]|$)' then '16U'
  when lower(name) ~ '(^|[^0-9])18([^0-9]|$)' then '18U'
  else age_group
end
where age_group is null;

alter table public.teams drop constraint if exists teams_age_group_check;
alter table public.teams add constraint teams_age_group_check check (age_group is null or age_group in ('14U','16U','18U'));
create index if not exists teams_age_group_idx on public.teams(organization_id,age_group);
