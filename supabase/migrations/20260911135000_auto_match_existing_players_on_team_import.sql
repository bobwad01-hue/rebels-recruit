create or replace function public.match_existing_profile_to_player_record()
returns trigger language plpgsql security definer set search_path='public' as $$
declare matched uuid;
begin
  if new.claimed_user_id is null and new.email is not null and btrim(new.email)<>'' then
    select id into matched from public.profiles where lower(btrim(email))=lower(btrim(new.email)) order by created_at limit 1;
    if matched is not null then
      new.claimed_user_id := matched;
      new.status := 'claimed';
      new.claimed_at := coalesce(new.claimed_at,now());
    end if;
  end if;
  return new;
end $$;
drop trigger if exists player_record_match_existing_profile on public.organization_player_records;
create trigger player_record_match_existing_profile before insert or update of email on public.organization_player_records for each row execute function public.match_existing_profile_to_player_record();

create or replace function public.materialize_new_import_item_if_claimed()
returns trigger language plpgsql security definer set search_path='public' as $$
declare uid uuid;
begin
  select claimed_user_id into uid from public.organization_player_records where id=new.player_record_id;
  if uid is not null then perform public.materialize_player_record(new.player_record_id,uid); end if;
  return new;
end $$;
drop trigger if exists import_item_materialize_if_claimed on public.organization_player_import_items;
create trigger import_item_materialize_if_claimed after insert on public.organization_player_import_items for each row execute function public.materialize_new_import_item_if_claimed();