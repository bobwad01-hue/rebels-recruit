revoke execute on function public.get_staff_recruiting_activity(uuid, integer) from public;
revoke execute on function public.get_staff_recruiting_activity(uuid, integer) from anon;
grant execute on function public.get_staff_recruiting_activity(uuid, integer) to authenticated;
