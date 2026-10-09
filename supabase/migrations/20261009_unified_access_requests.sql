-- Unified, invitation-optional access requests. Only authenticated server routes use service_role.
CREATE TABLE IF NOT EXISTS public.access_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
 team_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
 athlete_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('athlete','parent','advisor','team_admin','org_admin')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 CONSTRAINT access_requests_target CHECK (
  (role = 'parent' AND athlete_user_id IS NOT NULL AND organization_id IS NULL AND cardinality(team_ids) = 0)
  OR (role <> 'parent' AND organization_id IS NOT NULL AND athlete_user_id IS NULL)
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS access_requests_one_pending_org
 ON public.access_requests (user_id,organization_id,role) WHERE status='pending' AND role <> 'parent';
CREATE UNIQUE INDEX IF NOT EXISTS access_requests_one_pending_parent
 ON public.access_requests (user_id,athlete_user_id) WHERE status='pending' AND role='parent';
CREATE INDEX IF NOT EXISTS access_requests_org_pending
 ON public.access_requests (organization_id,requested_at DESC) WHERE status='pending';
CREATE INDEX IF NOT EXISTS access_requests_athlete_pending
 ON public.access_requests (athlete_user_id,requested_at DESC) WHERE status='pending' AND role='parent';
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_requests FROM anon,authenticated;
-- No client RLS policies. All reads/writes require authenticated, authorized server endpoints.
