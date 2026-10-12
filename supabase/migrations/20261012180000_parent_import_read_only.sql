-- Parent / Guardian approval grants recruiting visibility, not record-writing rights.
-- Remove the historical import-only INSERT exceptions while retaining all
-- athlete, assigned advisor, organization admin, and owner edit policies.
-- No existing athlete data is changed.
BEGIN;

DROP POLICY IF EXISTS "parents import linked college relationships" ON public.athlete_colleges;
DROP POLICY IF EXISTS "parents import linked coach relationships" ON public.athlete_coaches;
DROP POLICY IF EXISTS "parents import linked interactions" ON public.interactions;

COMMIT;
