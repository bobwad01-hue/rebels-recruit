-- Google account chooser first: no email entry or email-bound preflight required.
-- This changes only Auth identity creation. Uninvited accounts remain pending_invite,
-- cannot access app APIs/data, and cannot self-activate.
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

  -- Google OAuth cannot know the selected account email until Auth creates it.
  -- Permit identity creation only for Google; new profiles remain pending_invite.
  -- Middleware, restrictive RLS and the OAuth callback block app access until
  -- an active invitation is redeemed and the account is activated server-side.
  IF NEW.raw_app_meta_data->>'provider' = 'google' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'RLTNL Recruiting is invitation-only. A valid team or organization invitation is required.'
    USING ERRCODE = 'P0001';
END; $$;

