create table if not exists public.google_workspace_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text,
  gmail_connected boolean not null default false,
  calendar_connected boolean not null default false,
  gmail_scope text,
  calendar_scope text,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.google_workspace_connections enable row level security;
drop policy if exists "users_read_own_google_connection" on public.google_workspace_connections;
create policy "users_read_own_google_connection" on public.google_workspace_connections for select to authenticated using (auth.uid() = user_id);
drop policy if exists "users_insert_own_google_connection" on public.google_workspace_connections;
create policy "users_insert_own_google_connection" on public.google_workspace_connections for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "users_update_own_google_connection" on public.google_workspace_connections;
create policy "users_update_own_google_connection" on public.google_workspace_connections for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
comment on table public.google_workspace_connections is 'Connection status only. OAuth refresh/access tokens must not be stored in this table.';
