-- Public demo requests are written only by the server's service-role client.
-- No public SELECT/INSERT/UPDATE policies; only authorized platform owners may
-- read/update via the protected server route.
create table if not exists public.organization_demo_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  email text not null check (char_length(email) between 5 and 254),
  organization_name text not null check (char_length(organization_name) between 2 and 150),
  organization_type text not null check (organization_type in ('travel_club','high_school','other')),
  role_title text check (role_title is null or char_length(role_title) <= 100),
  team_count text check (team_count is null or team_count in ('1','2-5','6-10','11+')),
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'new' check (status in ('new','contacted','closed')),
  notification_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.organization_demo_requests enable row level security;
create index if not exists organization_demo_requests_created_idx
  on public.organization_demo_requests (created_at desc);
create index if not exists organization_demo_requests_email_idx
  on public.organization_demo_requests (email, created_at desc);
comment on table public.organization_demo_requests is
  'Organization demo inquiries; service-role only, with access restricted to verified platform owners in the server API.';
