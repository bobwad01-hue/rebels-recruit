create table if not exists public.college_enrichment (
  college_id uuid primary key references public.colleges(id) on delete cascade,
  ipeds_unitid bigint unique,
  opeid text,
  website text,
  admissions_url text,
  financial_aid_url text,
  net_price_calculator_url text,
  latitude double precision,
  longitude double precision,
  enrollment_total integer,
  undergraduate_enrollment integer,
  tuition_in_state integer,
  tuition_out_of_state integer,
  total_cost_in_state integer,
  total_cost_out_of_state integer,
  room_board integer,
  locale_code integer,
  campus_setting text,
  religious_affiliation_code integer,
  religious_affiliation text,
  climate_profile text[] not null default '{}',
  avg_annual_temp_f numeric,
  avg_january_temp_f numeric,
  avg_july_temp_f numeric,
  annual_precip_in numeric,
  annual_snow_in numeric,
  source_year integer,
  source_release text,
  source_payload jsonb not null default '{}'::jsonb,
  last_source_check timestamptz,
  last_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.college_majors (
  college_id uuid not null references public.colleges(id) on delete cascade,
  cip_code text not null,
  cip_title text not null,
  award_level text not null default '',
  completions integer,
  source_year integer,
  last_source_check timestamptz,
  updated_at timestamptz not null default now(),
  primary key (college_id,cip_code,award_level)
);

create table if not exists public.college_data_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','partial','failed','skipped')),
  source_release text,
  rows_seen integer not null default 0,
  rows_matched integer not null default 0,
  rows_updated integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.college_source_checks (
  college_id uuid not null references public.colleges(id) on delete cascade,
  source text not null,
  source_url text,
  etag text,
  last_modified text,
  last_status integer,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  content_hash text,
  primary key (college_id,source)
);

create index if not exists college_enrichment_ipeds_idx on public.college_enrichment(ipeds_unitid);
create index if not exists college_enrichment_updated_idx on public.college_enrichment(updated_at desc);
create index if not exists college_majors_title_idx on public.college_majors(cip_title);
create index if not exists college_sync_runs_started_idx on public.college_data_sync_runs(started_at desc);

alter table public.college_enrichment enable row level security;
alter table public.college_majors enable row level security;
alter table public.college_data_sync_runs enable row level security;
alter table public.college_source_checks enable row level security;

drop policy if exists "authenticated read college enrichment" on public.college_enrichment;
create policy "authenticated read college enrichment" on public.college_enrichment for select to authenticated using (true);
drop policy if exists "authenticated read college majors" on public.college_majors;
create policy "authenticated read college majors" on public.college_majors for select to authenticated using (true);
