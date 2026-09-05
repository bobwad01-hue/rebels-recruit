drop policy if exists "users create own notifications" on public.notifications;
create policy "users create own notifications"
on public.notifications
for insert to authenticated
with check ((select auth.uid()) = user_id);

grant insert on public.notifications to authenticated;
