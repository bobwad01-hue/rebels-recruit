-- Parent-selected relationship label is informational; it never grants athlete data access.
ALTER TABLE public.parent_guardian_access
  ADD COLUMN IF NOT EXISTS relationship_type text NOT NULL DEFAULT 'parent'
  CONSTRAINT parent_guardian_access_relationship_type_check CHECK (relationship_type IN ('parent','guardian'));
