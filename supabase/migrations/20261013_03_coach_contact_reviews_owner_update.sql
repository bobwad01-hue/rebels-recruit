-- Allow only Super Owners to resolve verified coach contact conflicts.
grant update on public.college_coach_contact_reviews to authenticated;
create policy college_coach_reviews_super_owner_update on public.college_coach_contact_reviews
for update to authenticated using (
 exists (select 1 from public.platform_roles where user_id=auth.uid() and role='super_owner')
) with check (
 exists (select 1 from public.platform_roles where user_id=auth.uid() and role='super_owner')
);