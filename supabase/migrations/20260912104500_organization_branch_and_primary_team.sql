alter table public.organizations
  add column if not exists brand_name text,
  add column if not exists branch_name text,
  add column if not exists city text,
  add column if not exists state text;

alter table public.teams
  add constraint teams_id_organization_unique unique (id, organization_id);

alter table public.athlete_profiles
  add column if not exists primary_organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists primary_team_id uuid;

alter table public.athlete_profiles
  add constraint athlete_profiles_primary_team_organization_fk
  foreign key (primary_team_id, primary_organization_id)
  references public.teams(id, organization_id)
  on delete set null;
