create table if not exists public.driving_time_cache (
  origin_key text not null,
  destination text not null,
  minutes integer not null check (minutes >= 0),
  distance_miles numeric(10,1) not null check (distance_miles >= 0),
  calculated_at timestamptz not null default now(),
  primary key (origin_key, destination)
);

alter table public.driving_time_cache enable row level security;

create policy "authenticated users can read driving time cache"
on public.driving_time_cache for select
to authenticated
using (true);

create policy "authenticated users can insert driving time cache"
on public.driving_time_cache for insert
to authenticated
with check (true);

create policy "authenticated users can update driving time cache"
on public.driving_time_cache for update
to authenticated
using (true)
with check (true);

comment on table public.driving_time_cache is
'Shared cache for traffic-unaware driving estimates. origin_key is a one-way hash of the athlete home ZIP; raw home ZIP is never stored here.';
