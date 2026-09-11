create or replace function public.match_existing_profile_to_player_record()
returns trigger language plpgsql security definer set search_path='public' as $$
declare matched uuid;
begin
  if new.claimed_user_id is null and new.email is not null and btrim(new.email)<>'' then
    select p.id into matched
    from public.profiles p
    join public.organization_members m on m.user_id=p.id and m.organization_id=new.organization_id and m.role='athlete' and m.status='active'
    where lower(btrim(p.email))=lower(btrim(new.email))
    order by p.created_at limit 1;
    if matched is not null then
      new.claimed_user_id := matched;
      new.status := 'claimed';
      new.claimed_at := coalesce(new.claimed_at,now());
    end if;
  end if;
  return new;
end $$;