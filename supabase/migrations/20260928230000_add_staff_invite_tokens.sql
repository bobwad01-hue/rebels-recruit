alter table public.organization_staff_invites add column if not exists invite_token uuid default gen_random_uuid();
create unique index if not exists organization_staff_invites_invite_token_key on public.organization_staff_invites(invite_token) where invite_token is not null;
