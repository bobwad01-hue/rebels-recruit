-- Public Google Calendar ICS subscriptions: organization-wide or team-only.
-- Applied to Supabase project oopjkpguqkelbmujppgy on 2026-10-08.
create table if not exists public.calendar_subscriptions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 team_id uuid references public.teams(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 120),
 feed_url text not null,
 enabled boolean not null default true,
 created_by_user_id uuid not null,
 last_synced_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists calendar_subscriptions_unique_feed_scope on public.calendar_subscriptions(organization_id,coalesce(team_id,'00000000-0000-0000-0000-000000000000'::uuid),feed_url);
create index if not exists calendar_subscriptions_org_team_idx on public.calendar_subscriptions(organization_id,team_id);
create table if not exists public.calendar_subscription_events (
 id uuid primary key default gen_random_uuid(),
 subscription_id uuid not null references public.calendar_subscriptions(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 event_key text not null,
 event_id text not null,
 name text not null,
 date date not null,
 end_date date,
 location text,
 description text,
 registration_url text,
 updated_at timestamptz not null default now(),
 unique(subscription_id,event_key)
);
create index if not exists calendar_subscription_events_org_date on public.calendar_subscription_events(organization_id,date);
create index if not exists calendar_subscription_events_event_id on public.calendar_subscription_events(event_id);
alter table public.calendar_subscriptions enable row level security;
alter table public.calendar_subscription_events enable row level security;
revoke all on public.calendar_subscriptions from anon,authenticated;
revoke all on public.calendar_subscription_events from anon,authenticated;
-- Only privileged server-side service_role accesses these tables. API handlers enforce org/team membership.
