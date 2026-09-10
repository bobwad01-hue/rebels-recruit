create or replace function public.log_athlete_video_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  athlete_tz text;
  activity_date date;
  host_label text;
begin
  select coalesce(timezone,'America/Chicago') into athlete_tz from public.profiles where id=new.athlete_user_id;
  activity_date := (now() at time zone coalesce(athlete_tz,'America/Chicago'))::date;
  host_label := case new.provider when 'youtube' then 'YouTube' when 'sportsrecruits' then 'SportsRecruits' when 'hudl' then 'Hudl' when 'vimeo' then 'Vimeo' when 'rebels_recruit' then 'Rebels Recruit' else 'external video host' end;
  insert into public.interactions(athlete_user_id,actor_user_id,college_id,coach_id,type,initiated_by,date,date_precision,note)
  values(new.athlete_user_id,new.athlete_user_id,null,null,'Recruiting Video Added','Athlete',activity_date,'exact',format('Added %s video "%s" to My Videos. Hosted by %s.',coalesce(new.category,'recruiting'),new.title,host_label));
  return new;
end;
$$;

drop trigger if exists athlete_video_activity_insert on public.athlete_videos;
create trigger athlete_video_activity_insert
after insert on public.athlete_videos
for each row execute function public.log_athlete_video_activity();
