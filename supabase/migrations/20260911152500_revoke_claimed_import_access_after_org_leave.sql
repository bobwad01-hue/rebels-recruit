drop policy if exists "org player records staff manage" on public.organization_player_records;
create policy "org player records staff manage" on public.organization_player_records for all
using (
  public.is_org_owner_admin(organization_id)
  and (
    claimed_user_id is null
    or exists(
      select 1 from public.organization_members m
      where m.organization_id=organization_player_records.organization_id
        and m.user_id=organization_player_records.claimed_user_id
        and m.role='athlete'
        and m.status='active'
    )
  )
)
with check (
  public.is_org_owner_admin(organization_id)
  and (
    claimed_user_id is null
    or exists(
      select 1 from public.organization_members m
      where m.organization_id=organization_player_records.organization_id
        and m.user_id=organization_player_records.claimed_user_id
        and m.role='athlete'
        and m.status in ('active','pending')
    )
  )
);

drop policy if exists "org import items staff manage" on public.organization_player_import_items;
create policy "org import items staff manage" on public.organization_player_import_items for all
using (
  exists(
    select 1 from public.organization_player_records r
    where r.id=player_record_id
      and public.is_org_owner_admin(r.organization_id)
      and (
        r.claimed_user_id is null
        or exists(
          select 1 from public.organization_members m
          where m.organization_id=r.organization_id
            and m.user_id=r.claimed_user_id
            and m.role='athlete'
            and m.status='active'
        )
      )
  )
)
with check (
  exists(
    select 1 from public.organization_player_records r
    where r.id=player_record_id
      and public.is_org_owner_admin(r.organization_id)
      and (
        r.claimed_user_id is null
        or exists(
          select 1 from public.organization_members m
          where m.organization_id=r.organization_id
            and m.user_id=r.claimed_user_id
            and m.role='athlete'
            and m.status in ('active','pending')
        )
      )
  )
);