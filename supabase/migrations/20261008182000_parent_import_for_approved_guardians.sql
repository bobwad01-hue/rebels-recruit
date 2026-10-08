-- An approved Parent/Guardian connection is sufficient for importing
-- existing recruiting history. No separate manage_history_import flag is required.
-- Revoking the parent connection immediately revokes these INSERT rights.
BEGIN;

DROP POLICY IF EXISTS "parents import linked college relationships" ON public.athlete_colleges;
CREATE POLICY "parents import linked college relationships"
ON public.athlete_colleges FOR INSERT TO authenticated
WITH CHECK (
 EXISTS (
  SELECT 1 FROM public.parent_guardian_access pga
  WHERE pga.parent_user_id=auth.uid()
    AND pga.athlete_user_id=athlete_colleges.athlete_user_id
    AND pga.status='active'
 )
);

DROP POLICY IF EXISTS "parents import linked coach relationships" ON public.athlete_coaches;
CREATE POLICY "parents import linked coach relationships"
ON public.athlete_coaches FOR INSERT TO authenticated
WITH CHECK (
 EXISTS (
  SELECT 1 FROM public.parent_guardian_access pga
  WHERE pga.parent_user_id=auth.uid()
    AND pga.athlete_user_id=athlete_coaches.athlete_user_id
    AND pga.status='active'
 )
);

DROP POLICY IF EXISTS "parents import linked interactions" ON public.interactions;
CREATE POLICY "parents import linked interactions"
ON public.interactions FOR INSERT TO authenticated
WITH CHECK (
 actor_user_id=auth.uid()
 AND EXISTS (
  SELECT 1 FROM public.parent_guardian_access pga
  WHERE pga.parent_user_id=auth.uid()
    AND pga.athlete_user_id=interactions.athlete_user_id
    AND pga.status='active'
 )
);

COMMIT;
