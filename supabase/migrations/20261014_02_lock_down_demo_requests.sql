-- Defense in depth: only the server-side service role can access inquiry rows.
-- No client-side Supabase role needs direct table access.
revoke all on table public.organization_demo_requests from anon, authenticated;
