create or replace view public.college_program_catalog
with (security_invoker = true) as
select cip_title, count(distinct college_id)::int as college_count, max(reporting_year)::int as reporting_year
from public.college_programs
where source='IPEDS'
group by cip_title;

grant select on public.college_program_catalog to authenticated;
