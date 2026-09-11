drop policy if exists "audit org" on public.audit_log;

create policy "audit owners admins or actor read"
on public.audit_log
for select
to authenticated
using (
  actor_user_id = auth.uid()
  or (
    organization_id is not null
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = audit_log.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('owner','admin')
    )
  )
);

create or replace function public.audit_organization_member_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  row_id uuid := coalesce(new.id,old.id);
  org_id uuid := coalesce(new.organization_id,old.organization_id);
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(org_id,actor,'organization_membership_created','organization_member',row_id,
      jsonb_build_object('user_id',new.user_id,'role',new.role,'status',new.status,'organization_view_access',new.organization_view_access));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(org_id,actor,'organization_membership_deleted','organization_member',row_id,
      jsonb_build_object('user_id',old.user_id,'role',old.role,'status',old.status,'organization_view_access',old.organization_view_access));
    return old;
  elsif old.status is distinct from new.status
     or old.role is distinct from new.role
     or old.organization_view_access is distinct from new.organization_view_access then
    insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(org_id,actor,'organization_membership_updated','organization_member',row_id,
      jsonb_build_object(
        'user_id',new.user_id,
        'from_status',old.status,'to_status',new.status,
        'from_role',old.role,'to_role',new.role,
        'from_organization_view_access',old.organization_view_access,
        'to_organization_view_access',new.organization_view_access
      ));
  end if;
  return new;
end;
$$;

drop trigger if exists audit_organization_member_change_trigger on public.organization_members;
create trigger audit_organization_member_change_trigger
after insert or update or delete on public.organization_members
for each row execute function public.audit_organization_member_change();

create or replace function public.audit_parent_guardian_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  row_id uuid := coalesce(new.id,old.id);
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(null,actor,'parent_access_created','parent_guardian_access',row_id,
      jsonb_build_object('athlete_user_id',new.athlete_user_id,'parent_user_id',new.parent_user_id,'status',new.status,'permissions',new.permissions));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(null,actor,'parent_access_deleted','parent_guardian_access',row_id,
      jsonb_build_object('athlete_user_id',old.athlete_user_id,'parent_user_id',old.parent_user_id,'status',old.status,'permissions',old.permissions));
    return old;
  elsif old.status is distinct from new.status or old.permissions is distinct from new.permissions then
    insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(null,actor,'parent_access_updated','parent_guardian_access',row_id,
      jsonb_build_object(
        'athlete_user_id',new.athlete_user_id,'parent_user_id',new.parent_user_id,
        'from_status',old.status,'to_status',new.status,
        'from_permissions',old.permissions,'to_permissions',new.permissions
      ));
  end if;
  return new;
end;
$$;

drop trigger if exists audit_parent_guardian_access_change_trigger on public.parent_guardian_access;
create trigger audit_parent_guardian_access_change_trigger
after insert or update or delete on public.parent_guardian_access
for each row execute function public.audit_parent_guardian_access_change();
