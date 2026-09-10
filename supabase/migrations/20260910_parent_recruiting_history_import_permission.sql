alter table public.parent_guardian_access alter column permissions set default '{"view_discovery":true,"view_connections":true,"view_activity":true,"view_events":true,"view_fit":true,"view_progress":true,"view_videos":true,"view_game_plan":true,"manage_calendar":false,"manage_history_import":false}'::jsonb;

create policy "parents import linked college relationships"
on public.athlete_colleges for insert to authenticated
with check (
  exists (
    select 1 from public.parent_guardian_access pga
    where pga.parent_user_id = auth.uid()
      and pga.athlete_user_id = athlete_colleges.athlete_user_id
      and pga.status = 'active'
      and coalesce((pga.permissions->>'manage_history_import')::boolean, false)
  )
);

create policy "parents import linked coach relationships"
on public.athlete_coaches for insert to authenticated
with check (
  exists (
    select 1 from public.parent_guardian_access pga
    where pga.parent_user_id = auth.uid()
      and pga.athlete_user_id = athlete_coaches.athlete_user_id
      and pga.status = 'active'
      and coalesce((pga.permissions->>'manage_history_import')::boolean, false)
  )
);

create policy "parents import linked interactions"
on public.interactions for insert to authenticated
with check (
  exists (
    select 1 from public.parent_guardian_access pga
    where pga.parent_user_id = auth.uid()
      and pga.athlete_user_id = interactions.athlete_user_id
      and pga.status = 'active'
      and coalesce((pga.permissions->>'manage_history_import')::boolean, false)
  )
);
