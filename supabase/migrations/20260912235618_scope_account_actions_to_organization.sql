create or replace function public.set_organization_member_suspended(
  target_organization uuid,
  target_user uuid,
  suspend boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role public.org_role;
begin
  if not exists (
    select 1
    from public.organization_members
    where organization_id = target_organization
      and user_id = (select auth.uid())
      and status = 'active'
      and role in ('owner', 'admin')
  ) then
    raise exception 'Owner or admin access required';
  end if;

  select role into target_role
  from public.organization_members
  where organization_id = target_organization and user_id = target_user;

  if target_role is null then
    raise exception 'User is not in this organization';
  end if;
  if target_role = 'owner' then
    raise exception 'The organization owner cannot be suspended';
  end if;

  update public.organization_members
  set status = case when suspend then 'suspended' else 'active' end,
      suspended_at = case when suspend then now() else null end,
      suspended_by = case when suspend then (select auth.uid()) else null end,
      organization_view_access = case when suspend then false else organization_view_access end
  where organization_id = target_organization and user_id = target_user;
end;
$$;

create or replace function public.delete_organization_account(
  target_organization uuid,
  target_user uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role public.org_role;
begin
  if not exists (
    select 1
    from public.organization_members
    where organization_id = target_organization
      and user_id = (select auth.uid())
      and status = 'active'
      and role in ('owner', 'admin')
  ) then
    raise exception 'Owner or admin access required';
  end if;

  select role into target_role
  from public.organization_members
  where organization_id = target_organization and user_id = target_user;

  if target_role is null then
    raise exception 'User is not in this organization';
  end if;
  if target_role = 'owner' then
    raise exception 'The organization owner cannot be deleted';
  end if;

  delete from auth.users where id = target_user;
end;
$$;

revoke all on function public.set_organization_member_suspended(uuid, uuid, boolean) from public, anon;
revoke all on function public.delete_organization_account(uuid, uuid) from public, anon;
revoke all on function public.set_organization_member_suspended(uuid, boolean) from public, anon, authenticated;
revoke all on function public.delete_organization_account(uuid) from public, anon, authenticated;
grant execute on function public.set_organization_member_suspended(uuid, uuid, boolean) to authenticated;
grant execute on function public.delete_organization_account(uuid, uuid) to authenticated;
