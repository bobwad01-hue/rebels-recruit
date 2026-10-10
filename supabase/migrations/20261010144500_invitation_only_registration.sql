-- Close public/independent signup until subscriptions are available.
-- Grandfather existing accounts; every new account must prove a live invitation
-- before auth.users can be inserted and must redeem it before using the app.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
  ALTER COLUMN registration_status SET DEFAULT 'pending_invite';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_registration_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_registration_status_check
  CHECK (registration_status IN ('active', 'pending_invite'));

CREATE INDEX IF NOT EXISTS idx_profiles_registration_status
  ON public.profiles(registration_status);

-- Only service-role backend actions may activate new registrations.
CREATE OR REPLACE FUNCTION public.protect_profile_account_lifecycle()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (
    OLD.account_status IS DISTINCT FROM NEW.account_status
    OR OLD.suspended_at IS DISTINCT FROM NEW.suspended_at
    OR OLD.suspended_by IS DISTINCT FROM NEW.suspended_by
    OR OLD.suspension_reason IS DISTINCT FROM NEW.suspension_reason
    OR OLD.registration_status IS DISTINCT FROM NEW.registration_status
  ) AND current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Account status is managed by Platform Administration'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $;

-- OAuth does not allow a client-supplied user_metadata join token before
-- creating the Auth user. A short-lived, email-bound intent bridges that gap.
-- The email must match the verified identity returned by the OAuth provider.
CREATE TABLE IF NOT EXISTS public.signup_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  join_link_id uuid NOT NULL REFERENCES public.organization_join_links(id) ON DELETE CASCADE,
  requested_role text NOT NULL CHECK (requested_role IN ('athlete','parent','advisor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  UNIQUE (email, join_link_id)
);
CREATE INDEX IF NOT EXISTS idx_signup_authorizations_expiry
  ON public.signup_authorizations(expires_at);
ALTER TABLE public.signup_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signup_authorizations FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.signup_authorizations TO service_role;

-- Resolve invitations inside Auth's transaction. User-provided metadata is
-- never trusted without matching a currently active team or staff invitation.
CREATE OR REPLACE FUNCTION public.enforce_invitation_only_auth_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_email text := lower(btrim(coalesce(NEW.email, '')));
  requested_role text := coalesce(NEW.raw_user_meta_data->>'app_role', 'athlete');
  join_token text := coalesce(NEW.raw_user_meta_data->>'join_token', '');
  authorized_id uuid;
BEGIN
  IF normalized_email = '' THEN
    RAISE EXCEPTION 'An organization or team invitation is required to create an account.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Organization staff invitations are email-bound. Verification by Auth or
  -- Google is still required before staff access is materialized.
  IF EXISTS (
    SELECT 1 FROM public.organization_staff_invites si
    WHERE lower(btrim(si.email)) = normalized_email
      AND si.status = 'pending'
  ) THEN
    RETURN NEW;
  END IF;

  -- Email/password signup passes the actual team invitation token in Auth
  -- metadata. Only live links with a valid role and non-archived team qualify.
  IF join_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    IF EXISTS (
      SELECT 1 FROM public.organization_join_links l
      LEFT JOIN public.teams t ON t.id = l.team_id
      WHERE l.token = join_token::uuid AND l.active = true
        AND (l.team_id IS NULL OR (t.id IS NOT NULL AND t.archived_at IS NULL))
        AND (
          (l.role = 'family' AND l.team_id IS NOT NULL AND requested_role IN ('athlete','parent'))
          OR (l.role IN ('athlete','parent') AND l.role = requested_role)
          OR (l.role IN ('advisor','admin','advisor_admin') AND requested_role = 'advisor')
        )
    ) THEN
      RETURN NEW;
    END IF;
  END IF;
  -- Google signup requires a recent server-validated intent for the exact
  -- Google account email. A revoked invitation cannot be reused.
  SELECT sa.id INTO authorized_id
  FROM public.signup_authorizations sa
  JOIN public.organization_join_links l ON l.id = sa.join_link_id
  LEFT JOIN public.teams t ON t.id = l.team_id
  WHERE sa.email = normalized_email
    AND sa.expires_at > now() AND l.active = true
    AND (l.team_id IS NULL OR (t.id IS NOT NULL AND t.archived_at IS NULL))
    AND (
      (l.role = 'family' AND l.team_id IS NOT NULL AND sa.requested_role IN ('athlete','parent'))
      OR (l.role IN ('athlete','parent') AND l.role = sa.requested_role)
      OR (l.role IN ('advisor','admin','advisor_admin') AND sa.requested_role = 'advisor')
    )
  ORDER BY sa.created_at DESC
  LIMIT 1;

  IF authorized_id IS NOT NULL THEN
    DELETE FROM public.signup_authorizations WHERE id = authorized_id;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'RLTNL Recruiting is invitation-only. A valid team or organization invitation is required.'
    USING ERRCODE = 'P0001';
END; $;

DROP TRIGGER IF EXISTS enforce_invitation_only_auth_signup ON auth.users;
CREATE TRIGGER enforce_invitation_only_auth_signup
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_invitation_only_auth_signup();

-- Existing JWT sessions and direct PostgREST access must not allow a new,
-- unredeemed account to use recruiting tables. Restrictive RLS is added to
-- every current public table; service_role and postgres bypass RLS.
CREATE OR REPLACE FUNCTION public.registration_is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.registration_status = 'active'
      AND p.account_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_registration_status()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT p.registration_status FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
  ), 'pending_invite');
$$;

-- Middleware needs an RLS-independent account check. Suspended accounts
-- cannot read their own profile under the restrictive policies above.
CREATE OR REPLACE FUNCTION public.current_account_access()
RETURNS TABLE (app_role text, account_status text, registration_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $
  SELECT p.app_role::text, p.account_status::text, p.registration_status::text
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid());
$;

REVOKE ALL ON FUNCTION public.current_account_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_account_access() TO authenticated;

REVOKE ALL ON FUNCTION public.registration_is_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_registration_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registration_is_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_registration_status() TO authenticated;

DO $$
DECLARE rec record;
BEGIN
  FOR rec IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r','p')
      AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS registration_required ON %I.%I',
      rec.schema_name, rec.table_name);
    EXECUTE format(
      'CREATE POLICY registration_required ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.registration_is_active())) WITH CHECK ((SELECT public.registration_is_active()))',
      rec.schema_name, rec.table_name);
  END LOOP;
END; $;
