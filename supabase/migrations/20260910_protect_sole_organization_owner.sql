create or replace function public.protect_sole_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare owner_count integer;
begin
  if old.role = 'owner' then
    select count(*) into owner_count
    from public.organization_members
    where organization_id = old.organization_id
      and role = 'owner'
      and status = 'active';

    if owner_count <= 1 then
      if tg_op = 'DELETE' then
        raise exception 'The sole organization owner cannot be deleted';
      end if;

      if new.organization_id is distinct from old.organization_id
         or new.user_id is distinct from old.user_id
         or new.role is distinct from old.role
         or new.status is distinct from old.status
         or new.suspended_at is distinct from old.suspended_at
         or new.suspended_by is distinct from old.suspended_by then
        raise exception 'The sole organization owner cannot be suspended, removed, reassigned, or have ownership altered';
      end if;
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_sole_organization_owner_trigger on public.organization_members;
create trigger protect_sole_organization_owner_trigger
before update or delete on public.organization_members
for each row execute function public.protect_sole_organization_owner();
