-- Team Admin coverage is derived from active team grants and approved roster membership.
-- Athlete revocations are durable exceptions; never materialize per-athlete grants.
create table if not exists public.athlete_team_admin_revocations (
 athlete_user_id uuid not null references public.profiles(id) on delete cascade,
 admin_user_id uuid not null references public.profiles(id) on delete cascade,
 revoked_at timestamptz not null default now(),
 primary key (athlete_user_id, admin_user_id),
 constraint athlete_team_admin_no_self_revoke check (athlete_user_id <> admin_user_id)
);
create index if not exists team_admin_active_grants_idx
 on public.team_user_roles (user_id,team_id) where role='admin' and status='active';
create index if not exists athlete_team_admin_revocations_admin_idx
 on public.athlete_team_admin_revocations (admin_user_id, athlete_user_id);
alter table public.athlete_team_admin_revocations enable row level security;
revoke all on public.athlete_team_admin_revocations from anon;
grant select, insert, delete on public.athlete_team_admin_revocations to authenticated;

drop policy if exists "athlete and blocked admin read revocations" on public.athlete_team_admin_revocations;
create policy "athlete and blocked admin read revocations"
 on public.athlete_team_admin_revocations for select to authenticated
 using (athlete_user_id = (select auth.uid()) or admin_user_id = (select auth.uid()));
drop policy if exists "athlete revokes team admin access" on public.athlete_team_admin_revocations;
create policy "athlete revokes team admin access"
 on public.athlete_team_admin_revocations for insert to authenticated
 with check (athlete_user_id = (select auth.uid()));
drop policy if exists "athlete restores team admin access" on public.athlete_team_admin_revocations;
create policy "athlete restores team admin access"
 on public.athlete_team_admin_revocations for delete to authenticated
 using (athlete_user_id = (select auth.uid()));

create or replace function public.team_admin_can_access_athlete(a uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select a = (select auth.uid()) or (
  not exists (
   select 1 from public.athlete_team_admin_revocations denied
   where denied.athlete_user_id = a and denied.admin_user_id = (select auth.uid())
  )
  and exists (
   select 1
   from public.team_user_roles staff
   join public.teams t on t.id = staff.team_id and t.archived_at is null
   join public.team_members athlete on athlete.team_id = t.id and athlete.user_id = a
   where staff.user_id = (select auth.uid())
    and staff.role = 'admin' and staff.status = 'active'
    and exists (
     select 1 from public.organization_members staff_member
     where staff_member.user_id = (select auth.uid())
      and staff_member.organization_id = t.organization_id
      and staff_member.status = 'active'
    )
    and exists (
     select 1 from public.organization_members m
     where m.user_id = a and m.organization_id = t.organization_id
      and m.status = 'active'
    )
    and exists (select 1 from public.athlete_profiles ap where ap.user_id = a)
  )
 );
$$;
revoke all on function public.team_admin_can_access_athlete(uuid) from public;
grant execute on function public.team_admin_can_access_athlete(uuid) to authenticated;

-- Active Team Admins may message covered athletes; a revocation removes this path.
create or replace function private.can_message_user(target_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $body$
 select target_user=(select auth.uid())
 or exists (
  select 1 from public.athlete_advisor_assignments aa
  where aa.status='active'
   and ((aa.athlete_user_id=(select auth.uid()) and aa.advisor_user_id=target_user)
    or (aa.advisor_user_id=(select auth.uid()) and aa.athlete_user_id=target_user))
 )
 or exists (
  select 1 from public.organization_members me
  join public.organization_members target on target.organization_id=me.organization_id
  where me.user_id=(select auth.uid()) and me.status='active'
   and target.user_id=target_user and target.status='active' and target.role='athlete'
   and (me.role in ('owner','admin') or (me.role='advisor' and me.organization_view_access))
 )
 or public.team_admin_can_access_athlete(target_user);
$body$;

-- Preserve existing independently granted Advisor, Organization Admin, and Super Owner rights.
-- A revoked Team Admin grant never reactivates through re-assignment or roster sync.
create or replace function public.can_access_athlete(a uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select public.is_super_owner()
 or a = (select auth.uid())
 or exists (
  select 1 from public.athlete_advisor_assignments aa
  where aa.athlete_user_id = a and aa.advisor_user_id = (select auth.uid()) and aa.status = 'active'
 )
 or exists (
  select 1 from public.organization_members me
  join public.organization_members athlete on athlete.organization_id = me.organization_id
  where me.user_id = (select auth.uid()) and me.status = 'active'
    and athlete.user_id = a and athlete.status = 'active'
    and me.role in ('owner','admin')
 )
 or public.team_admin_can_access_athlete(a);
$$;

create or replace function public.can_edit_athlete(a uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select public.is_super_owner()
 or a = (select auth.uid())
 or exists (
  select 1 from public.athlete_advisor_assignments aa
  where aa.athlete_user_id = a and aa.advisor_user_id = (select auth.uid()) and aa.status = 'active'
 )
 or exists (
  select 1 from public.organization_members me
  join public.organization_members athlete on athlete.organization_id = me.organization_id
  where me.user_id = (select auth.uid()) and me.status = 'active'
    and athlete.user_id = a and athlete.status = 'active'
    and me.role in ('owner','admin')
 )
 or public.team_admin_can_access_athlete(a);
$$;

drop policy if exists "team admin sees covered athlete profile" on public.profiles;
create policy "team admin sees covered athlete profile" on public.profiles
 for select to authenticated using (public.team_admin_can_access_athlete(id));

-- School advice previously had a special-case organization staff write policy.
drop policy if exists "team admin adds school advice" on public.advisor_school_advice;
create policy "team admin adds school advice" on public.advisor_school_advice
 for insert to authenticated
 with check (advisor_user_id = (select auth.uid()) and public.team_admin_can_access_athlete(athlete_user_id));
drop policy if exists "team admin updates own school advice" on public.advisor_school_advice;
create policy "team admin updates own school advice" on public.advisor_school_advice
 for update to authenticated
 using (advisor_user_id = (select auth.uid()) and public.team_admin_can_access_athlete(athlete_user_id))
 with check (advisor_user_id = (select auth.uid()) and public.team_admin_can_access_athlete(athlete_user_id));
drop policy if exists "team admin reads covered behavior" on public.athlete_behavior_events;
create policy "team admin reads covered behavior" on public.athlete_behavior_events
 for select to authenticated using (public.team_admin_can_access_athlete(athlete_user_id));

-- Existing Team Admins without a legacy organization context need a scoped staff
-- membership for the current organization UI. Do not reactivate suspended members.
insert into public.organization_members (organization_id,user_id,role,status,organization_view_access)
select distinct t.organization_id,r.user_id,'advisor'::public.org_role,'active',false
from public.team_user_roles r
join public.teams t on t.id=r.team_id
where r.role='admin' and r.status='active'
and not exists (
 select 1 from public.organization_members m
 where m.organization_id=t.organization_id and m.user_id=r.user_id
)
on conflict (organization_id,user_id) do nothing;

-- Single server-side roster resolver used by Team Admin views. No private
-- athlete data is returned here; every result is checked against the deny list.
create or replace function public.my_team_admin_athlete_ids()
returns table (athlete_user_id uuid)
language sql stable security definer set search_path = ''
as $body$
 select distinct tm.user_id
 from public.team_user_roles r
 join public.teams t on t.id=r.team_id and t.archived_at is null
 join public.team_members tm on tm.team_id=t.id
 where r.user_id=(select auth.uid()) and r.role='admin' and r.status='active'
 and public.team_admin_can_access_athlete(tm.user_id);
$body$;
revoke all on function public.my_team_admin_athlete_ids() from public;
grant execute on function public.my_team_admin_athlete_ids() to authenticated;

drop policy if exists "team admin reads covered school rankings" on public.athlete_school_rankings;
create policy "team admin reads covered school rankings" on public.athlete_school_rankings
 for select to authenticated using (public.team_admin_can_access_athlete(athlete_user_id));
drop policy if exists "team admin writes covered advisor targets" on public.athlete_school_rankings;
create policy "team admin writes covered advisor targets" on public.athlete_school_rankings
 for all to authenticated
 using (list_type='advisor_target' and public.team_admin_can_access_athlete(athlete_user_id))
 with check (list_type='advisor_target' and public.team_admin_can_access_athlete(athlete_user_id));

-- Athlete-controlled access changes are auditable, including restoration.
create or replace function private.audit_team_admin_access_exception()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
 values (
  coalesce(new.athlete_user_id,old.athlete_user_id),
  case when tg_op = 'INSERT' then 'athlete_revoked_team_admin_access' else 'athlete_restored_team_admin_access' end,
  'profile', coalesce(new.athlete_user_id,old.athlete_user_id),
  jsonb_build_object('team_admin_user_id',coalesce(new.admin_user_id,old.admin_user_id))
 );
 return coalesce(new,old);
end;
$$;
drop trigger if exists audit_team_admin_access_exception on public.athlete_team_admin_revocations;
create trigger audit_team_admin_access_exception
after insert or delete on public.athlete_team_admin_revocations
for each row execute function private.audit_team_admin_access_exception();
