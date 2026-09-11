create extension if not exists pgcrypto;

alter table public.organizations add column if not exists join_code text;
create unique index if not exists organizations_join_code_unique on public.organizations(join_code) where join_code is not null;
update public.organizations set join_code=upper(substr(encode(gen_random_bytes(6),'hex'),1,10)) where join_code is null;
alter table public.organizations alter column join_code set not null;

create table if not exists public.organization_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  file_name text,
  status text not null default 'reviewed' check (status in ('reviewed','imported','failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_player_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  claimed_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  grad_year integer,
  team_label text,
  jersey_number text,
  status text not null default 'unclaimed' check (status in ('unclaimed','claimed','archived')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists organization_player_records_org_idx on public.organization_player_records(organization_id);
create index if not exists organization_player_records_claimed_idx on public.organization_player_records(claimed_user_id);
create unique index if not exists organization_player_records_org_email_unique on public.organization_player_records(organization_id, lower(email)) where email is not null and btrim(email)<>'';

create table if not exists public.organization_player_import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.organization_import_batches(id) on delete set null,
  player_record_id uuid not null references public.organization_player_records(id) on delete cascade,
  college_id uuid references public.colleges(id) on delete set null,
  coach_id uuid references public.college_coaches(id) on delete set null,
  school_name text,
  coach_name text,
  coach_email text,
  coach_phone text,
  stage text,
  activity_type text,
  activity_date date,
  date_precision text not null default 'unknown' check (date_precision in ('exact','month','year','unknown')),
  date_year integer,
  date_month integer check (date_month is null or date_month between 1 and 12),
  note text,
  row_key text,
  raw_row jsonb not null default '{}'::jsonb,
  materialized_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists organization_player_import_items_player_idx on public.organization_player_import_items(player_record_id);
create unique index if not exists organization_player_import_items_row_key_unique on public.organization_player_import_items(player_record_id,row_key) where row_key is not null;

alter table public.interactions add column if not exists source_organization_id uuid references public.organizations(id) on delete set null;
alter table public.interactions add column if not exists import_batch_id uuid references public.organization_import_batches(id) on delete set null;

create table if not exists public.interaction_recipients (
  interaction_id uuid not null references public.interactions(id) on delete cascade,
  coach_id uuid not null references public.college_coaches(id) on delete cascade,
  recipient_type text not null default 'to' check (recipient_type in ('to','cc')),
  primary key (interaction_id, coach_id)
);
create index if not exists interaction_recipients_coach_idx on public.interaction_recipients(coach_id);

alter table public.organization_import_batches enable row level security;
alter table public.organization_player_records enable row level security;
alter table public.organization_player_import_items enable row level security;
alter table public.interaction_recipients enable row level security;

drop policy if exists "org import batches access" on public.organization_import_batches;
create policy "org import batches access" on public.organization_import_batches for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
drop policy if exists "org player records access" on public.organization_player_records;
create policy "org player records access" on public.organization_player_records for all using (public.is_org_member(organization_id) or claimed_user_id=auth.uid()) with check (public.is_org_member(organization_id) or claimed_user_id=auth.uid());
drop policy if exists "org import items access" on public.organization_player_import_items;
create policy "org import items access" on public.organization_player_import_items for all using (exists(select 1 from public.organization_player_records r where r.id=player_record_id and (public.is_org_member(r.organization_id) or r.claimed_user_id=auth.uid()))) with check (exists(select 1 from public.organization_player_records r where r.id=player_record_id and (public.is_org_member(r.organization_id) or r.claimed_user_id=auth.uid())));
drop policy if exists "interaction recipients access" on public.interaction_recipients;
create policy "interaction recipients access" on public.interaction_recipients for all using (exists(select 1 from public.interactions i where i.id=interaction_id and public.can_access_athlete(i.athlete_user_id))) with check (exists(select 1 from public.interactions i where i.id=interaction_id and public.can_access_athlete(i.athlete_user_id)));

create or replace function public.claim_pending_player_records_for_current_user()
returns jsonb language plpgsql security definer set search_path='public' as $$
declare
  uid uuid := auth.uid();
  user_email text;
  rec record;
  item record;
  claimed_count int := 0;
  materialized_count int := 0;
  rel_status public.pipeline_stage;
  interaction_id uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select lower(btrim(email)) into user_email from public.profiles where id=uid;
  if user_email is null or user_email='' then return jsonb_build_object('claimed',0,'materialized',0); end if;
  for rec in select * from public.organization_player_records where claimed_user_id is null and email is not null and lower(btrim(email))=user_email for update loop
    update public.organization_player_records set claimed_user_id=uid,status='claimed',claimed_at=now(),updated_at=now() where id=rec.id;
    insert into public.organization_members(organization_id,user_id,role,status,joined_at) values(rec.organization_id,uid,'athlete','pending',now()) on conflict (organization_id,user_id) do nothing;
    claimed_count := claimed_count + 1;
    for item in select * from public.organization_player_import_items where player_record_id=rec.id and materialized_at is null order by created_at loop
      if item.college_id is null then continue; end if;
      begin rel_status := coalesce(nullif(item.stage,''),'Researching')::public.pipeline_stage; exception when others then rel_status := 'Researching'::public.pipeline_stage; end;
      insert into public.athlete_colleges(athlete_user_id,college_id,status) values(uid,item.college_id,rel_status) on conflict (athlete_user_id,college_id) do nothing;
      if item.coach_id is not null then insert into public.athlete_coaches(athlete_user_id,college_id,coach_id) values(uid,item.college_id,item.coach_id) on conflict (athlete_user_id,coach_id) do nothing; end if;
      if coalesce(item.note,'')<>'' or item.activity_date is not null or coalesce(item.activity_type,'')<>'' then
        if not exists(select 1 from public.interactions i where i.athlete_user_id=uid and i.college_id=item.college_id and coalesce(i.coach_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(item.coach_id,'00000000-0000-0000-0000-000000000000'::uuid) and i.type=coalesce(nullif(item.activity_type,''),'Imported Recruiting Activity') and coalesce(i.date,'0001-01-01'::date)=coalesce(item.activity_date,'0001-01-01'::date) and coalesce(i.note,'')=coalesce(item.note,'')) then
          insert into public.interactions(athlete_user_id,actor_user_id,college_id,coach_id,type,initiated_by,date,date_precision,date_year,date_month,note,source_organization_id,import_batch_id)
          values(uid,uid,item.college_id,item.coach_id,coalesce(nullif(item.activity_type,''),'Imported Recruiting Activity'),'Athlete',item.activity_date,item.date_precision,item.date_year,item.date_month,nullif(item.note,''),rec.organization_id,item.batch_id) returning id into interaction_id;
          if item.coach_id is not null then insert into public.interaction_recipients(interaction_id,coach_id,recipient_type) values(interaction_id,item.coach_id,'to') on conflict do nothing; end if;
        end if;
      end if;
      update public.organization_player_import_items set materialized_at=now() where id=item.id;
      materialized_count := materialized_count + 1;
    end loop;
  end loop;
  return jsonb_build_object('claimed',claimed_count,'materialized',materialized_count);
end $$;
grant execute on function public.claim_pending_player_records_for_current_user() to authenticated;

create or replace function public.accept_organization_membership(target_org uuid)
returns void language plpgsql security definer set search_path='public' as $$
begin
  update public.organization_members set status='active',joined_at=coalesce(joined_at,now()),suspended_at=null,suspended_by=null where organization_id=target_org and user_id=auth.uid() and role='athlete' and status in ('pending','left','invited');
  if not found then raise exception 'No pending organization membership found'; end if;
end $$;
grant execute on function public.accept_organization_membership(uuid) to authenticated;

create or replace function public.leave_organization(target_org uuid)
returns void language plpgsql security definer set search_path='public' as $$
begin
  update public.organization_members set status='left',suspended_at=null,suspended_by=null where organization_id=target_org and user_id=auth.uid() and role='athlete' and status='active';
  if not found then raise exception 'Active athlete membership not found'; end if;
  update public.athlete_advisor_assignments set status='revoked',responded_at=now() where organization_id=target_org and athlete_user_id=auth.uid() and status='active';
end $$;
grant execute on function public.leave_organization(uuid) to authenticated;

create or replace function public.join_organization_by_code(code text)
returns uuid language plpgsql security definer set search_path='public' as $$
declare oid uuid;
begin
  select id into oid from public.organizations where upper(join_code)=upper(btrim(code));
  if oid is null then raise exception 'Organization code not found'; end if;
  insert into public.organization_members(organization_id,user_id,role,status,joined_at) values(oid,auth.uid(),'athlete','active',now()) on conflict (organization_id,user_id) do update set status='active',joined_at=now(),suspended_at=null,suspended_by=null;
  return oid;
end $$;
grant execute on function public.join_organization_by_code(text) to authenticated;
