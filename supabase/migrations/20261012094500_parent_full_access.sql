-- Approved Parent / Guardian connections grant all read access; pending, declined and revoked grant none.
-- Keep the legacy permissions JSON for compatibility, but remove it as an authorization input.
CREATE OR REPLACE FUNCTION public.parent_can_view_athlete(target_athlete_id uuid, permission_key text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_guardian_access p
    WHERE p.athlete_user_id = target_athlete_id
      AND p.parent_user_id = (SELECT auth.uid())
      AND p.status = 'active'
  );
$$;
GRANT EXECUTE ON FUNCTION public.parent_can_view_athlete(uuid,text) TO authenticated;

-- Clear previously restricted sections for existing confirmed relationships.
UPDATE public.parent_guardian_access
SET permissions = COALESCE(permissions,'{}'::jsonb) ||
  '{"view_discovery":true,"view_connections":true,"view_activity":true,"view_events":true,"view_fit":true,"view_progress":true,"view_videos":true,"view_game_plan":true,"manage_calendar":true}'::jsonb,
  updated_at = now()
WHERE status = 'active';

ALTER TABLE public.parent_guardian_access
ALTER COLUMN permissions SET DEFAULT '{"view_discovery":true,"view_connections":true,"view_activity":true,"view_events":true,"view_fit":true,"view_progress":true,"view_videos":true,"view_game_plan":true,"manage_calendar":true}'::jsonb;
