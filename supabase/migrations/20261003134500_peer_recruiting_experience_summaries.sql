drop view if exists public.athlete_recruiting_experience_summary;
create view public.athlete_recruiting_experience_summary with (security_invoker=true) as
select college_id,count(*)::int response_count,
round(avg(overall_experience)::numeric,1) overall_experience,
round(avg(communication)::numeric,1) communication,
round(100.0*count(*) filter(where standing_clarity='very_clearly')/nullif(count(*) filter(where standing_clarity is not null),0))::int clarity_percent,
round(100.0*count(*) filter(where recommend_engaging='yes')/nullif(count(*) filter(where recommend_engaging is not null),0))::int recommend_percent
from public.athlete_recruiting_experiences where core_completed_at is not null and publication_status not in ('held','removed') group by college_id;
grant select on public.athlete_recruiting_experience_summary to authenticated;