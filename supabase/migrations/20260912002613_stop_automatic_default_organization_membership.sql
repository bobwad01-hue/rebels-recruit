create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path='public'
as $function$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'app_role','athlete');
begin
  if requested_role not in ('athlete','advisor','parent') then
    requested_role := 'athlete';
  end if;

  insert into public.profiles(id,full_name,email,app_role)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email,requested_role)
  on conflict(id) do update
    set full_name=excluded.full_name,
        email=excluded.email,
        app_role=excluded.app_role;

  -- New accounts are organization-neutral by default. Organization access
  -- must come from an explicit join, approved import claim, invitation, or
  -- other authorized workflow.
  return new;
end;
$function$;
