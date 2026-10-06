alter table public.team_user_roles drop constraint if exists team_user_roles_role_check;
alter table public.team_user_roles add constraint team_user_roles_role_check check (role in ('admin','advisor','athlete','parent'));

alter table public.team_user_roles drop constraint if exists team_user_roles_status_check;
alter table public.team_user_roles add constraint team_user_roles_status_check check (status in ('active','pending','revoked','suspended'));

alter table public.organization_join_links drop constraint if exists organization_join_links_role_check;
alter table public.organization_join_links add constraint organization_join_links_role_check check (role in ('admin','advisor','advisor_admin','athlete','parent'));

alter table public.organization_join_requests drop constraint if exists organization_join_requests_role_check;
alter table public.organization_join_requests add constraint organization_join_requests_role_check check (role in ('admin','advisor','advisor_admin','athlete','parent'));
