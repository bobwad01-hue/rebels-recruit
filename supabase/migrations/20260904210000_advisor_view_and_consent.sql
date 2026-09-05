create schema if not exists private;

alter table public.athlete_advisor_assignments
  add column if not exists status text not null default 'pending',
  add column if not exists relationship_type text not null default 'Recruiting Advisor',
  add column if not exists invited_at timestamptz not null default now(),
  add column if not exists responded_at timestamptz;

update public.athlete_advisor_assignments set status='pending' where status is null or status not in ('pending','active','declined','revoked','suspended');
create unique index if not exists athlete_advisor_assignments_unique_pair on public.athlete_advisor_assignments(athlete_user_id,advisor_user_id,organization_id);
create index if not exists athlete_advisor_assignments_advisor_idx on public.athlete_advisor_assignments(advisor_user_id,status);
create index if not exists athlete_advisor_assignments_athlete_idx on public.athlete_advisor_assignments(athlete_user_id,status);

create table if not exists public.advisor_tasks (id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations(id) on delete cascade,athlete_user_id uuid not null references auth.users(id) on delete cascade,created_by_user_id uuid not null references auth.users(id) on delete cascade,assigned_to_user_id uuid references auth.users(id) on delete set null,title text not null,description text,due_date date,status text not null default 'open' check(status in ('open','completed','cancelled')),completed_at timestamptz,created_at timestamptz not null default now());
create table if not exists public.advisor_conversations (id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations(id) on delete cascade,conversation_type text not null default 'direct' check(conversation_type in ('direct','group')),subject text,created_by_user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now());
create table if not exists public.advisor_conversation_members (id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.advisor_conversations(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),unique(conversation_id,user_id));
create table if not exists public.advisor_messages (id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.advisor_conversations(id) on delete cascade,sender_user_id uuid not null references auth.users(id) on delete cascade,body text not null,created_at timestamptz not null default now(),read_at timestamptz);
create index if not exists advisor_tasks_athlete_idx on public.advisor_tasks(athlete_user_id,status,due_date);
create index if not exists advisor_tasks_assigned_idx on public.advisor_tasks(assigned_to_user_id,status,due_date);
create index if not exists advisor_conversation_members_user_idx on public.advisor_conversation_members(user_id);
create index if not exists advisor_messages_conversation_idx on public.advisor_messages(conversation_id,created_at);

alter table public.advisor_tasks enable row level security;alter table public.advisor_conversations enable row level security;alter table public.advisor_conversation_members enable row level security;alter table public.advisor_messages enable row level security;

create or replace function private.is_staff_user() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.organization_members om where om.user_id=(select auth.uid()) and om.status='active' and om.role in ('owner','admin','advisor')); $$;
revoke execute on function private.is_staff_user() from public;grant usage on schema private to authenticated;grant execute on function private.is_staff_user() to authenticated;
create or replace function private.can_message_user(target_user uuid) returns boolean language sql stable security definer set search_path='' as $$ select target_user=(select auth.uid()) or exists(select 1 from public.athlete_advisor_assignments aa where aa.status='active' and ((aa.athlete_user_id=(select auth.uid()) and aa.advisor_user_id=target_user) or (aa.advisor_user_id=(select auth.uid()) and aa.athlete_user_id=target_user))); $$;
revoke execute on function private.can_message_user(uuid) from public;grant execute on function private.can_message_user(uuid) to authenticated;

create or replace function public.can_access_athlete(a uuid) returns boolean language sql stable security definer set search_path='' as $$ select a=(select auth.uid()) or exists(select 1 from public.athlete_advisor_assignments aa where aa.athlete_user_id=a and aa.advisor_user_id=(select auth.uid()) and aa.status='active') or exists(select 1 from public.organization_members me join public.organization_members athlete on athlete.organization_id=me.organization_id where me.user_id=(select auth.uid()) and me.status='active' and athlete.user_id=a and athlete.status='active' and me.role in ('owner','admin')); $$;

-- Consent-aware advisor relationship policies.
drop policy if exists "assignments access" on public.athlete_advisor_assignments;
create policy "assignment select" on public.athlete_advisor_assignments for select to authenticated using (athlete_user_id=(select auth.uid()) or advisor_user_id=(select auth.uid()) or exists(select 1 from public.organization_members om where om.user_id=(select auth.uid()) and om.organization_id=athlete_advisor_assignments.organization_id and om.status='active' and om.role in ('owner','admin')));
create policy "advisor creates pending assignments" on public.athlete_advisor_assignments for insert to authenticated with check (advisor_user_id=(select auth.uid()) and status='pending' and exists(select 1 from public.organization_members om where om.user_id=(select auth.uid()) and om.organization_id=athlete_advisor_assignments.organization_id and om.status='active' and om.role in ('advisor','admin','owner')));
create policy "player responds to invitation" on public.athlete_advisor_assignments for update to authenticated using (athlete_user_id=(select auth.uid()) and status='pending') with check (athlete_user_id=(select auth.uid()) and status in ('active','declined'));
create policy "player revokes active advisor" on public.athlete_advisor_assignments for update to authenticated using (athlete_user_id=(select auth.uid()) and status='active') with check (athlete_user_id=(select auth.uid()) and status='revoked');
create policy "advisor cancels own pending" on public.athlete_advisor_assignments for update to authenticated using (advisor_user_id=(select auth.uid()) and status='pending') with check (advisor_user_id=(select auth.uid()) and status='revoked');
create policy "staff manages assignments" on public.athlete_advisor_assignments for update to authenticated using (exists(select 1 from public.organization_members om where om.user_id=(select auth.uid()) and om.organization_id=athlete_advisor_assignments.organization_id and om.status='active' and om.role in ('owner','admin'))) with check (exists(select 1 from public.organization_members om where om.user_id=(select auth.uid()) and om.organization_id=athlete_advisor_assignments.organization_id and om.status='active' and om.role in ('owner','admin')));

create policy "tasks select" on public.advisor_tasks for select to authenticated using (athlete_user_id=(select auth.uid()) or created_by_user_id=(select auth.uid()) or assigned_to_user_id=(select auth.uid()) or (select public.can_access_athlete(athlete_user_id)));
create policy "tasks insert" on public.advisor_tasks for insert to authenticated with check (created_by_user_id=(select auth.uid()) and (select public.can_access_athlete(athlete_user_id)));
create policy "tasks update" on public.advisor_tasks for update to authenticated using (athlete_user_id=(select auth.uid()) or created_by_user_id=(select auth.uid()) or assigned_to_user_id=(select auth.uid()) or (select public.can_access_athlete(athlete_user_id))) with check (athlete_user_id=(select auth.uid()) or (select public.can_access_athlete(athlete_user_id)));
create policy "tasks delete" on public.advisor_tasks for delete to authenticated using (created_by_user_id=(select auth.uid()) or athlete_user_id=(select auth.uid()));

create policy "conversation member select" on public.advisor_conversation_members for select to authenticated using (user_id=(select auth.uid()) or exists(select 1 from public.advisor_conversation_members m where m.conversation_id=advisor_conversation_members.conversation_id and m.user_id=(select auth.uid())));
create policy "conversation create" on public.advisor_conversations for insert to authenticated with check (created_by_user_id=(select auth.uid()) and (select private.is_staff_user()));
create policy "conversation select" on public.advisor_conversations for select to authenticated using (exists(select 1 from public.advisor_conversation_members m where m.conversation_id=advisor_conversations.id and m.user_id=(select auth.uid())));
create policy "conversation member insert" on public.advisor_conversation_members for insert to authenticated with check (exists(select 1 from public.advisor_conversations c where c.id=conversation_id and c.created_by_user_id=(select auth.uid())) and (user_id=(select auth.uid()) or (select private.can_message_user(user_id))));
create policy "conversation member delete" on public.advisor_conversation_members for delete to authenticated using (exists(select 1 from public.advisor_conversations c where c.id=conversation_id and c.created_by_user_id=(select auth.uid())));
create policy "messages select" on public.advisor_messages for select to authenticated using (exists(select 1 from public.advisor_conversation_members m where m.conversation_id=advisor_messages.conversation_id and m.user_id=(select auth.uid())));
create policy "messages insert" on public.advisor_messages for insert to authenticated with check (sender_user_id=(select auth.uid()) and exists(select 1 from public.advisor_conversation_members m where m.conversation_id=advisor_messages.conversation_id and m.user_id=(select auth.uid())));
create policy "messages update read" on public.advisor_messages for update to authenticated using (exists(select 1 from public.advisor_conversation_members m where m.conversation_id=advisor_messages.conversation_id and m.user_id=(select auth.uid()))) with check (exists(select 1 from public.advisor_conversation_members m where m.conversation_id=advisor_messages.conversation_id and m.user_id=(select auth.uid())));

grant select,insert,update,delete on public.advisor_tasks to authenticated;grant select,insert,update,delete on public.advisor_conversations to authenticated;grant select,insert,delete on public.advisor_conversation_members to authenticated;grant select,insert,update on public.advisor_messages to authenticated;

alter function public.is_org_member(uuid) set search_path='public';
alter function public.set_reminder_completed_at() set search_path='public';
alter function public.sync_interaction_followup() set search_path='public';
revoke execute on function public.can_access_athlete(uuid) from anon;
revoke execute on function public.is_org_member(uuid) from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
