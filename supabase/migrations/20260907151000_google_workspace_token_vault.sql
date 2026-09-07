create table if not exists public.google_workspace_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null check (service in ('gmail','calendar')),
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  refresh_token_tag text not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, service)
);

alter table public.google_workspace_tokens enable row level security;
revoke all on table public.google_workspace_tokens from anon, authenticated;
grant all on table public.google_workspace_tokens to service_role;

create index if not exists google_workspace_tokens_user_id_idx on public.google_workspace_tokens(user_id);

alter policy users_read_own_google_connection on public.google_workspace_connections
  using ((select auth.uid()) = user_id);
alter policy users_insert_own_google_connection on public.google_workspace_connections
  with check ((select auth.uid()) = user_id);
alter policy users_update_own_google_connection on public.google_workspace_connections
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
