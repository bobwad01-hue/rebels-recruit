create table if not exists public.organization_user_roles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','advisor','athlete','parent')),
  status text not null default 'active' check (status in ('active','pending','revoked')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (organization_id,user_id,role)
);
create table if not exists public.team_user_roles (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('advisor','athlete','parent')),
  status text not null default 'active' check (status in ('active','pending','revoked')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (team_id,user_id,role)
);
create table if not exists public.organization_join_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  role text not null check (role in ('admin','advisor','athlete','parent')),
  token uuid not null default gen_random_uuid() unique,
  requires_approval boolean not null default false,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists organization_join_links_scope_role_unique on public.organization_join_links(organization_id,coalesce(team_id,'00000000-0000-0000-0000-000000000000'::uuid),role) where active;
create table if not exists public.organization_join_requests (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.organization_join_links(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','advisor','athlete','parent')),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  unique(link_id,user_id)
);
insert into public.organization_user_roles(organization_id,user_id,role,status,granted_at)
select organization_id,user_id,case when role::text='owner' then 'admin' else role::text end,'active',coalesce(joined_at,now()) from public.organization_members where status='active' and role::text in ('owner','admin','advisor','athlete') on conflict do nothing;
insert into public.team_user_roles(team_id,user_id,role,status,granted_at)
select tm.team_id,tm.user_id,om.role::text,'active',now() from public.team_members tm join public.teams t on t.id=tm.team_id join public.organization_members om on om.organization_id=t.organization_id and om.user_id=tm.user_id where om.role::text in ('advisor','athlete') on conflict do nothing;
