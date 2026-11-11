-- Offer tracking: athlete-owned records with row-level security.
create table if not exists public.athlete_school_offers (
 id uuid primary key default gen_random_uuid(),
 athlete_user_id uuid not null references auth.users(id) on delete cascade,
 college_id uuid not null references public.colleges(id) on delete cascade,
 offer_date date,
 decision_deadline date,
 tuition_fees numeric(12,2),
 housing_meals numeric(12,2),
 other_costs numeric(12,2),
 academic_aid numeric(12,2),
 athletic_aid numeric(12,2),
 other_grants numeric(12,2),
 notes text,
 renewal_terms text,
 athletic_opportunity text,
 academic_notes text,
 status text not null default 'received' check (status in ('received','considering','accepted','declined','withdrawn')),
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(athlete_user_id,college_id),
 constraint offer_nonnegative check (tuition_fees >= 0 and housing_meals >= 0 and other_costs >= 0 and academic_aid >= 0 and athletic_aid >= 0 and other_grants >= 0)
);
alter table public.athlete_school_offers enable row level security;
drop policy if exists "athletes view own offers" on public.athlete_school_offers;
drop policy if exists "athletes create own offers" on public.athlete_school_offers;
drop policy if exists "athletes update own offers" on public.athlete_school_offers;
drop policy if exists "athletes delete own offers" on public.athlete_school_offers;
create policy "athletes view own offers" on public.athlete_school_offers for select to authenticated using ((select auth.uid())=athlete_user_id);
create policy "athletes create own offers" on public.athlete_school_offers for insert to authenticated with check ((select auth.uid())=athlete_user_id);
create policy "athletes update own offers" on public.athlete_school_offers for update to authenticated using ((select auth.uid())=athlete_user_id) with check ((select auth.uid())=athlete_user_id);
create policy "athletes delete own offers" on public.athlete_school_offers for delete to authenticated using ((select auth.uid())=athlete_user_id);
grant select,insert,update,delete on public.athlete_school_offers to authenticated;
create index if not exists athlete_school_offers_deadline_idx on public.athlete_school_offers(athlete_user_id,decision_deadline);
