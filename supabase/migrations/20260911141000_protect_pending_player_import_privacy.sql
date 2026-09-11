drop policy if exists "org import batches access" on public.organization_import_batches;
create policy "org import batches manage" on public.organization_import_batches for all using (public.is_org_owner_admin(organization_id)) with check (public.is_org_owner_admin(organization_id));

drop policy if exists "org player records access" on public.organization_player_records;
create policy "org player records staff manage" on public.organization_player_records for all using (public.is_org_owner_admin(organization_id)) with check (public.is_org_owner_admin(organization_id));
create policy "claimed player reads own imported identity" on public.organization_player_records for select using (claimed_user_id=auth.uid());

drop policy if exists "org import items access" on public.organization_player_import_items;
create policy "org import items staff manage" on public.organization_player_import_items for all using (exists(select 1 from public.organization_player_records r where r.id=player_record_id and public.is_org_owner_admin(r.organization_id))) with check (exists(select 1 from public.organization_player_records r where r.id=player_record_id and public.is_org_owner_admin(r.organization_id)));
create policy "claimed player reads own imported items" on public.organization_player_import_items for select using (exists(select 1 from public.organization_player_records r where r.id=player_record_id and r.claimed_user_id=auth.uid()));