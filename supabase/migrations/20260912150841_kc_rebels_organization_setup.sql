alter table public.teams add column if not exists archived_at timestamptz;

update public.organizations set name='KC Rebels',branch_name=null,city='Spring Hill',state='KS'
where id='c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid;

insert into public.teams(organization_id,name,age_group)
select 'c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid,v.name,v.age_group
from (values ('18 National Mayhugh','18U'),('18 Regional Jenkins','18U'),('16 National Olsen','16U'),('16 Regional Lickel','16U'),('14 National Shafer','14U'),('14 Regional Oestmann','14U')) v(name,age_group)
where not exists (select 1 from public.teams t where t.organization_id='c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid and lower(t.name)=lower(v.name) and t.archived_at is null);

update public.teams set age_group='16U'
where organization_id='c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid and lower(name)=lower('16 Regional Lickel') and archived_at is null;

with canonical as (select id from public.teams where organization_id='c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid and name='16 Regional Lickel' and archived_at is null limit 1),
duplicate as (select id from public.teams where organization_id='c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid and name='KC Rebels 16 Regional Lickel' and archived_at is null)
insert into public.team_members(team_id,user_id)
select canonical.id,tm.user_id from public.team_members tm cross join canonical where tm.team_id in (select id from duplicate)
on conflict do nothing;

delete from public.team_members where team_id in (select id from public.teams where organization_id='c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid and name='KC Rebels 16 Regional Lickel');
update public.teams set archived_at=now() where organization_id='c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid and name='KC Rebels 16 Regional Lickel' and archived_at is null;

insert into public.organization_members(organization_id,user_id,role,status,joined_at)
select 'c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid,p.id,'athlete','active',now() from public.profiles p where p.app_role='athlete'
on conflict (organization_id,user_id) do update set role='athlete',status='active',joined_at=coalesce(public.organization_members.joined_at,now()),suspended_at=null,suspended_by=null;

delete from public.team_members tm using public.teams t
where tm.team_id=t.id and t.organization_id='c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid and tm.user_id in (select id from public.profiles where app_role='athlete');

insert into public.team_members(team_id,user_id)
select t.id,p.id from public.teams t cross join public.profiles p
where t.organization_id='c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid and t.name='16 Regional Lickel' and t.archived_at is null and p.app_role='athlete'
on conflict do nothing;

update public.athlete_profiles ap set primary_organization_id='c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid,primary_team_id=t.id
from public.teams t where ap.user_id in (select id from public.profiles where app_role='athlete') and t.organization_id='c7052ff4-68e0-4d3a-b680-780f55453bbb'::uuid and t.name='16 Regional Lickel' and t.archived_at is null;

create unique index if not exists teams_active_org_name_unique on public.teams(organization_id,lower(name)) where archived_at is null;
