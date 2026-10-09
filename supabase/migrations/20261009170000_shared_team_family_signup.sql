-- One reusable signup code/link per team for Athletes and Parents/Guardians.
-- Staff links always require approval, including links issued before this migration.
ALTER TABLE public.organization_join_links DROP CONSTRAINT IF EXISTS organization_join_links_role_check;
ALTER TABLE public.organization_join_links ADD CONSTRAINT organization_join_links_role_check
  CHECK (role IN ('admin','advisor','advisor_admin','athlete','parent','family'));

ALTER TABLE public.organization_join_links ADD COLUMN IF NOT EXISTS signup_code text;
CREATE UNIQUE INDEX IF NOT EXISTS organization_join_links_signup_code_unique
  ON public.organization_join_links (upper(signup_code)) WHERE signup_code IS NOT NULL;
ALTER TABLE public.organization_join_links ADD CONSTRAINT organization_join_links_family_scope_check
  CHECK (role <> 'family' OR (team_id IS NOT NULL AND requires_approval = false AND signup_code IS NOT NULL));
ALTER TABLE public.organization_join_links ADD CONSTRAINT organization_join_links_signup_code_format_check
  CHECK (signup_code IS NULL OR signup_code ~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$');

UPDATE public.organization_join_links
SET requires_approval = true
WHERE role IN ('admin','advisor','advisor_admin') AND requires_approval = false;
