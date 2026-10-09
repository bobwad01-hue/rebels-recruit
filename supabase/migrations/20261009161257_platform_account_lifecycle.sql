-- Platform Super Owner account lifecycle. Keep suspension state in the database
-- so an existing access token cannot simply bypass the app's suspension check.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_account_status_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('active', 'suspended'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles(account_status);

-- Existing RLS permits users to edit their own profiles. Prevent them from
-- clearing an administrative suspension through a direct Supabase request.
CREATE OR REPLACE FUNCTION public.protect_profile_account_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (
    OLD.account_status IS DISTINCT FROM NEW.account_status
    OR OLD.suspended_at IS DISTINCT FROM NEW.suspended_at
    OR OLD.suspended_by IS DISTINCT FROM NEW.suspended_by
    OR OLD.suspension_reason IS DISTINCT FROM NEW.suspension_reason
  ) AND current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Account status is managed by Platform Administration'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_profile_account_lifecycle ON public.profiles;
CREATE TRIGGER protect_profile_account_lifecycle
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_account_lifecycle();
