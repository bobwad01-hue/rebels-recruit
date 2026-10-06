drop policy if exists "users read own coach suggestions" on public.college_coach_update_suggestions;
create policy "users read own coach suggestions" on public.college_coach_update_suggestions for select to authenticated using (
 submitted_by_user_id=auth.uid() or exists(select 1 from public.platform_roles pr where pr.user_id=auth.uid() and pr.role='super_owner')
);
drop policy if exists "super owner reviews coach suggestions" on public.college_coach_update_suggestions;
create policy "super owner reviews coach suggestions" on public.college_coach_update_suggestions for update to authenticated using (
 exists(select 1 from public.platform_roles pr where pr.user_id=auth.uid() and pr.role='super_owner')
) with check (
 exists(select 1 from public.platform_roles pr where pr.user_id=auth.uid() and pr.role='super_owner')
);
