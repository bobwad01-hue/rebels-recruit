create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','cancelled','processing','completed','denied')),
  requested_at timestamptz not null default now(),
  cancelled_at timestamptz,
  processed_at timestamptz,
  reason text,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists account_deletion_one_open_per_user on public.account_deletion_requests(user_id) where status in ('requested','processing');
alter table public.account_deletion_requests enable row level security;
drop policy if exists "users read own deletion requests" on public.account_deletion_requests;
create policy "users read own deletion requests" on public.account_deletion_requests for select to authenticated using (user_id=auth.uid());

create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  affected_user_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('missing_athlete','wrong_organization_access','missing_import_history','google_disconnected','wrong_team','parent_access','account_deletion','other')),
  status text not null default 'open' check (status in ('open','investigating','waiting_on_user','resolved','closed')),
  description text not null,
  diagnostic_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists support_cases_org_created_idx on public.support_cases(organization_id,created_at desc);
create index if not exists support_cases_reporter_created_idx on public.support_cases(reporter_user_id,created_at desc);
alter table public.support_cases enable row level security;
drop policy if exists "users read own support cases" on public.support_cases;
create policy "users read own support cases" on public.support_cases for select to authenticated using (reporter_user_id=auth.uid());

create or replace function public.request_account_deletion(request_reason text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select id into rid from public.account_deletion_requests where user_id=auth.uid() and status in ('requested','processing') order by requested_at desc limit 1;
 if rid is not null then return rid; end if;
 insert into public.account_deletion_requests(user_id,reason) values(auth.uid(),nullif(trim(request_reason),'')) returning id into rid;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),'account_deletion_requested','account',auth.uid(),jsonb_build_object('request_id',rid));
 return rid;
end$$;

create or replace function public.cancel_account_deletion()
returns boolean language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.account_deletion_requests set status='cancelled',cancelled_at=now(),updated_at=now() where user_id=auth.uid() and status='requested' returning id into rid;
 if rid is null then return false; end if;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),'account_deletion_cancelled','account',auth.uid(),jsonb_build_object('request_id',rid));
 return true;
end$$;

revoke all on function public.request_account_deletion(text) from public;
revoke all on function public.cancel_account_deletion() from public;
grant execute on function public.request_account_deletion(text) to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
