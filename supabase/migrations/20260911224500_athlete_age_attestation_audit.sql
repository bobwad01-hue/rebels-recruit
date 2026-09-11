create table if not exists public.user_age_attestations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 attestation text not null check (attestation='age_13_or_older'),
 attested_at timestamptz not null default now(),
 context text not null check (context in ('signup','existing_account')),
 user_agent text,
 ip_address inet,
 created_at timestamptz not null default now()
);
create index if not exists user_age_attestations_user_idx on public.user_age_attestations(user_id,attested_at desc);
alter table public.user_age_attestations enable row level security;
drop policy if exists "users read own age attestations" on public.user_age_attestations;
create policy "users read own age attestations" on public.user_age_attestations for select to authenticated using(user_id=auth.uid());
