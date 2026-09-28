insert into public.colleges (name,state,city,division,conference,website,school_type,source_url,search_aliases)
select 'Northern Oklahoma College - Enid','Oklahoma','Enid','JC','Region 2','https://www.noc.edu/enid/','Public','https://www.noc.edu/enid/',array['NOC Enid','Northern Oklahoma College Enid','Jets']
where not exists (
  select 1 from public.colleges where lower(name) in ('northern oklahoma college - enid','northern oklahoma college – enid') or (lower(name)='northern oklahoma college' and lower(city)='enid')
);