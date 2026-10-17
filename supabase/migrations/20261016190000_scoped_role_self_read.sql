-- Role holders must be able to read their own scoped grants.
-- Registration gating is RESTRICTIVE; it is not a standalone SELECT allowance.
drop policy if exists "read own team roles" on public.team_user_roles;
create policy "read own team roles" on public.team_user_roles
 for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "read own organization roles" on public.organization_user_roles;
create policy "read own organization roles" on public.organization_user_roles
 for select to authenticated using (user_id = (select auth.uid()));
