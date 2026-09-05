drop policy if exists "advisor re-invites prior relationship" on public.athlete_advisor_assignments;
create policy "advisor re-invites prior relationship" on public.athlete_advisor_assignments for update to authenticated using (advisor_user_id=(select auth.uid()) and status in ('declined','revoked')) with check (advisor_user_id=(select auth.uid()) and status='pending');
