create table if not exists public.recruiting_email_templates (
  id text primary key check (char_length(id) between 1 and 100 and id <> 'custom'),
  label text not null check (char_length(trim(label)) between 1 and 100),
  purpose text not null default 'Recruiting',
  guidance text not null default '',
  ask text not null default '',
  subject_template text,
  openings jsonb not null default '[{"label":"Starter","text":""}]'::jsonb
    check (jsonb_typeof(openings) = 'array' and jsonb_array_length(openings) between 1 and 8),
  full_signature boolean not null default false,
  requires_school_reason boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 1000,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.recruiting_email_templates is 'Super Owner-managed overrides and additions to the RLTNL athlete recruiting email playbook. Built-in templates not present here remain available; inactive overrides hide built-ins.';
alter table public.recruiting_email_templates enable row level security;
create policy recruiting_email_templates_read on public.recruiting_email_templates
  for select to authenticated using (true);
create policy recruiting_email_templates_insert_owner on public.recruiting_email_templates
  for insert to authenticated with check (
    exists (select 1 from public.platform_roles where user_id = (select auth.uid()) and role = 'super_owner')
  );
create policy recruiting_email_templates_update_owner on public.recruiting_email_templates
  for update to authenticated using (
    exists (select 1 from public.platform_roles where user_id = (select auth.uid()) and role = 'super_owner')
  ) with check (
    exists (select 1 from public.platform_roles where user_id = (select auth.uid()) and role = 'super_owner')
  );
create policy recruiting_email_templates_delete_owner on public.recruiting_email_templates
  for delete to authenticated using (
    exists (select 1 from public.platform_roles where user_id = (select auth.uid()) and role = 'super_owner')
  );
grant select, insert, update, delete on public.recruiting_email_templates to authenticated;
