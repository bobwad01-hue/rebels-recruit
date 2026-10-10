-- Remove accidentally provisioned Athlete roles from parent-only accounts.
-- A genuine dual-role account retains Athlete when an athlete profile exists.
DELETE FROM public.user_roles ur
USING public.profiles p
WHERE ur.user_id = p.id
  AND ur.role = 'athlete'
  AND p.app_role = 'parent'
  AND NOT EXISTS (
    SELECT 1 FROM public.athlete_profiles ap WHERE ap.user_id = ur.user_id
  );
