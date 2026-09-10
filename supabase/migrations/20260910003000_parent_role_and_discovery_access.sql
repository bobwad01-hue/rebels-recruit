alter table public.profiles drop constraint if exists profiles_app_role_check;
alter table public.profiles add constraint profiles_app_role_check check (app_role = any (array['athlete'::text,'advisor'::text,'admin'::text,'owner'::text,'parent'::text]));

alter table public.parent_guardian_access alter column permissions set default '{"view_fit":true,"view_events":true,"view_progress":true,"view_connections":true,"view_activity":true,"view_videos":true,"view_game_plan":true,"view_discovery":true,"manage_calendar":false}'::jsonb;
update public.parent_guardian_access set permissions = '{"view_fit":true,"view_events":true,"view_progress":true,"view_connections":true,"view_activity":true,"view_videos":true,"view_game_plan":true,"view_discovery":true,"manage_calendar":false}'::jsonb || permissions;

create or replace function public.parent_can_view_athlete(target_athlete_id uuid, permission_key text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.parent_guardian_access p
    where p.athlete_user_id = target_athlete_id
      and p.parent_user_id = (select auth.uid())
      and p.status = 'active'
      and (permission_key is null or coalesce((p.permissions ->> permission_key)::boolean,false))
  );
$$;
grant execute on function public.parent_can_view_athlete(uuid,text) to authenticated;

create or replace function public.request_parent_access_by_email(target_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare athlete_id uuid; link_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Not signed in'; end if;
  if not exists(select 1 from public.profiles where id=(select auth.uid()) and app_role='parent') then raise exception 'Parent account required'; end if;
  select id into athlete_id from public.profiles where lower(email)=lower(trim(target_email)) and app_role='athlete' limit 1;
  if athlete_id is null then raise exception 'No athlete account found for that email'; end if;
  insert into public.parent_guardian_access(athlete_user_id,parent_user_id,status)
  values(athlete_id,(select auth.uid()),'pending')
  on conflict (athlete_user_id,parent_user_id) do update set status='pending',updated_at=now()
  returning id into link_id;
  return link_id;
end;
$$;
grant execute on function public.request_parent_access_by_email(text) to authenticated;

create policy "parents view linked athlete profile" on public.profiles for select to authenticated using (public.parent_can_view_athlete(id,null));
create policy "athletes view linked parent profiles" on public.profiles for select to authenticated using (exists (select 1 from public.parent_guardian_access p where p.parent_user_id=profiles.id and p.athlete_user_id=(select auth.uid())));
create policy "parents view linked athlete details" on public.athlete_profiles for select to authenticated using (public.parent_can_view_athlete(user_id,'view_progress'));
create policy "parents view linked connections" on public.athlete_colleges for select to authenticated using (public.parent_can_view_athlete(athlete_user_id,'view_connections'));
create policy "parents view linked coach relationships" on public.athlete_coaches for select to authenticated using (public.parent_can_view_athlete(athlete_user_id,'view_connections'));
create policy "parents view linked activity" on public.interactions for select to authenticated using (public.parent_can_view_athlete(athlete_user_id,'view_activity'));
create policy "parents view linked events" on public.athlete_events for select to authenticated using (public.parent_can_view_athlete(athlete_user_id,'view_events'));
create policy "parents view linked fit" on public.college_fit_profiles for select to authenticated using (public.parent_can_view_athlete(user_id,'view_fit'));
create policy "parents view linked videos" on public.athlete_videos for select to authenticated using (public.parent_can_view_athlete(athlete_user_id,'view_videos'));
create policy "parents view linked game plan" on public.recruiting_game_plans for select to authenticated using (public.parent_can_view_athlete(athlete_user_id,'view_game_plan'));
create policy "parents view linked discovery feedback" on public.college_discovery_feedback for select to authenticated using (public.parent_can_view_athlete(athlete_user_id,'view_discovery'));
