-- Consolidate duplicate ACTIVE college coach identities only.
-- Do not merge inactive/retired/departed staff history.
-- Each removed identity and every dependent row is backed up before re-keying.
-- Transactional migration: any failed reference update rolls the whole merge back.

alter table public.college_coaches
  add column if not exists contact_verification_needed boolean not null default false;

do $merge$
declare
  pair record;
  src public.college_coaches%rowtype;
  dest public.college_coaches%rowtype;
  fk record;
  dep_rows jsonb;
  dependencies jsonb;
  dest_athlete_rows jsonb;
  audit_id bigint;
  fields text[];
  field_name text;
  original_value text;
  preferred_value text;
  existing_count integer;
begin
  for pair in
    with ranked as (
      select cc.id,cc.college_id,
        lower(btrim(cc.first_name)) as first_key,
        lower(btrim(cc.last_name)) as last_key,
        row_number() over (
          partition by cc.college_id,lower(btrim(cc.first_name)),lower(btrim(cc.last_name))
          order by
            case when cc.verification_status='verified' then 0
                 when cc.official_source_status='high_confidence' or cc.verification_status='high_confidence' then 1
                 else 2 end,
            coalesce(cc.verification_confidence,0) desc,
            case when nullif(btrim(cc.email),'') is not null then 0 else 1 end,
            (select count(*) from public.athlete_coaches ac where ac.coach_id=cc.id) desc,
            cc.updated_at desc nulls last,
            cc.id
        ) as rank
      from public.college_coaches cc
      where cc.lifecycle_status='active'
        and nullif(btrim(cc.first_name),'') is not null
        and nullif(btrim(cc.last_name),'') is not null
    )
    select d.id as duplicate_id,c.id as canonical_id
    from ranked d join ranked c
      on d.college_id=c.college_id
     and d.first_key=c.first_key and d.last_key=c.last_key
     and c.rank=1
    where d.rank>1
    order by d.college_id,d.first_key,d.last_key,d.id
  loop
    select * into src from public.college_coaches where id=pair.duplicate_id for update;
    select * into dest from public.college_coaches where id=pair.canonical_id for update;
    if src.id is null or dest.id is null then
      raise exception 'Coach identity changed during merge';
    end if;
    if src.college_id is distinct from dest.college_id
      or lower(btrim(src.first_name)) is distinct from lower(btrim(dest.first_name))
      or lower(btrim(src.last_name)) is distinct from lower(btrim(dest.last_name))
      or src.lifecycle_status <> 'active' or dest.lifecycle_status <> 'active' then
      raise exception 'Unsafe identity merge attempted: % to %',src.id,dest.id;
    end if;

    -- Full before-images for every referencing table, including the original coach row.
    dependencies:='{}'::jsonb;
    for fk in
      select con.conrelid::regclass as ref_table,att.attname as ref_column
      from pg_constraint con
      join pg_attribute att on att.attrelid=con.conrelid and att.attnum=con.conkey[1]
      where con.contype='f' and con.confrelid='public.college_coaches'::regclass
        and array_length(con.conkey,1)=1
    loop
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from %s t where %I=$1',
        fk.ref_table,fk.ref_column
      ) into dep_rows using src.id;
      if dep_rows <> '[]'::jsonb then
        dependencies:=dependencies||jsonb_build_object(fk.ref_table::text,dep_rows);
      end if;
    end loop;
    select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb)
      into dest_athlete_rows
    from public.athlete_coaches a where a.coach_id=dest.id;

    fields:='{}'::text[];
    for field_name,preferred_value,original_value in
      select * from (values
        ('email',dest.email,src.email),
        ('phone',dest.phone,src.phone),
        ('x_url',dest.x_url,src.x_url),
        ('instagram_url',dest.instagram_url,src.instagram_url)
      ) v(field_name,preferred_value,original_value)
    loop
      if nullif(btrim(preferred_value),'') is not null
         and nullif(btrim(original_value),'') is not null
         and (
           case when field_name='phone'
             then regexp_replace(preferred_value,'[^0-9]','','g') <> regexp_replace(original_value,'[^0-9]','','g')
             else lower(btrim(preferred_value)) <> lower(btrim(original_value))
           end
         ) then
        fields:=array_append(fields,field_name);
      end if;
    end loop;

    insert into public.college_coach_identity_merges
      (duplicate_coach_id,canonical_coach_id,college_id,
       duplicate_record_before,canonical_record_before,dependent_rows_before,
       canonical_athlete_relationships_before,conflict_fields)
    values (src.id,dest.id,src.college_id,to_jsonb(src),to_jsonb(dest),
            dependencies,dest_athlete_rows,fields)
    returning id into audit_id;

    -- A person may have been attached twice to the same athlete. Preserve the
    -- source relationship in the audit, combine useful notes, then remove only
    -- the redundant relationship row before changing its coach_id.
    update public.athlete_coaches target
    set last_contact_date=case when target.last_contact_date is null then source.last_contact_date
                               when source.last_contact_date is null then target.last_contact_date
                               else greatest(target.last_contact_date,source.last_contact_date) end,
        relationship_rating=coalesce(target.relationship_rating,source.relationship_rating),
        next_step=coalesce(nullif(btrim(target.next_step),''),source.next_step),
        notes=case
          when nullif(btrim(source.notes),'') is null then target.notes
          when nullif(btrim(target.notes),'') is null then source.notes
          when btrim(target.notes)=btrim(source.notes) then target.notes
          else target.notes||E'\n\n[Consolidated coach relationship notes]\n'||source.notes end,
        archived_at=case when target.archived_at is null or source.archived_at is null
                         then null else least(target.archived_at,source.archived_at) end,
        created_at=least(target.created_at,source.created_at)
    from public.athlete_coaches source
    where source.coach_id=src.id
      and target.coach_id=dest.id
      and source.athlete_user_id=target.athlete_user_id;

    delete from public.athlete_coaches source
    where source.coach_id=src.id
      and exists (select 1 from public.athlete_coaches target
                  where target.coach_id=dest.id
                    and target.athlete_user_id=source.athlete_user_id);

    update public.athlete_coaches set coach_id=dest.id where coach_id=src.id;

    -- Retarget all other declared foreign keys; never delete interactions,
    -- reminders, Gmail records, private notes, snapshots, or staff history.
    for fk in
      select con.conrelid::regclass as ref_table,att.attname as ref_column
      from pg_constraint con
      join pg_attribute att on att.attrelid=con.conrelid and att.attnum=con.conkey[1]
      where con.contype='f' and con.confrelid='public.college_coaches'::regclass
        and array_length(con.conkey,1)=1
        and con.conrelid <> 'public.athlete_coaches'::regclass
    loop
      execute format('update %s set %I=$1 where %I=$2',
                     fk.ref_table,fk.ref_column,fk.ref_column)
      using dest.id,src.id;
    end loop;

    -- Prefer the better-sourced canonical identity; fill only missing fields.
    -- Any conflicting contact values remain in the audit AND the review queue.
    update public.college_coaches cc
    set email=coalesce(nullif(btrim(cc.email),''),nullif(btrim(src.email),'')),
        phone=coalesce(nullif(btrim(cc.phone),''),nullif(btrim(src.phone),'')),
        x_url=coalesce(nullif(btrim(cc.x_url),''),nullif(btrim(src.x_url),'')),
        x_handle=coalesce(nullif(btrim(cc.x_handle),''),nullif(btrim(src.x_handle),'')),
        instagram_url=coalesce(nullif(btrim(cc.instagram_url),''),nullif(btrim(src.instagram_url),'')),
        title=coalesce(nullif(btrim(cc.title),''),src.title),
        role_category=coalesce(cc.role_category,src.role_category),
        official_bio_url=coalesce(nullif(btrim(cc.official_bio_url),''),src.official_bio_url),
        official_source_url=coalesce(nullif(btrim(cc.official_source_url),''),src.official_source_url),
        contact_verification_needed=cc.contact_verification_needed or cardinality(fields)>0
    where cc.id=dest.id;

    -- Remove only the redundant coach identity after all dependent rows moved.
    delete from public.college_coaches where id=src.id;

    insert into public.college_coach_aliases(old_coach_id,canonical_coach_id,merge_audit_id)
    values (src.id,dest.id,audit_id);

    for field_name,preferred_value,original_value in
      select * from (values
        ('email',dest.email,src.email),
        ('phone',dest.phone,src.phone),
        ('x_url',dest.x_url,src.x_url),
        ('instagram_url',dest.instagram_url,src.instagram_url)
      ) v(field_name,preferred_value,original_value)
    loop
      if field_name=any(fields) then
        insert into public.college_coach_contact_reviews
          (coach_id,field_name,observed_values,source_duplicate_coach_ids)
        values (dest.id,field_name,array[preferred_value,original_value],array[src.id])
        on conflict on constraint college_coach_contact_reviews_coach_id_field_name_key do update
          set observed_values=excluded.observed_values,
              source_duplicate_coach_ids=excluded.source_duplicate_coach_ids,
              status='pending';
      end if;
    end loop;
  end loop;

  select count(*) into existing_count from (
    select 1 from public.college_coaches
    where lifecycle_status='active'
      and nullif(btrim(first_name),'') is not null
      and nullif(btrim(last_name),'') is not null
    group by college_id,lower(btrim(first_name)),lower(btrim(last_name))
    having count(*)>1
  ) remaining;
  if existing_count<>0 then
    raise exception 'Duplicate active coach identities remain: %',existing_count;
  end if;
end
$merge$;

drop trigger if exists trg_prevent_duplicate_active_college_coach on public.college_coaches;
create trigger trg_prevent_duplicate_active_college_coach
  before insert or update of college_id,first_name,last_name,lifecycle_status
  on public.college_coaches
  for each row execute function public.prevent_duplicate_active_college_coach();
