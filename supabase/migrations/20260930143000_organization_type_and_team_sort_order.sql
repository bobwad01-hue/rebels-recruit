alter table public.organizations add column if not exists organization_type text;
alter table public.organizations drop constraint if exists organizations_organization_type_check;
alter table public.organizations add constraint organizations_organization_type_check
  check (organization_type is null or organization_type in ('travel_club','high_school'));

alter table public.teams add column if not exists sort_order integer;

with ranked as (
  select id, row_number() over (partition by organization_id order by created_at, name, id) * 10 as n
  from public.teams
)
update public.teams t
set sort_order = r.n
from ranked r
where t.id = r.id and t.sort_order is null;

create index if not exists teams_organization_sort_order_idx
  on public.teams(organization_id, sort_order);
