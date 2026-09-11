create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('terms_of_service','privacy_policy')),
  version text not null,
  effective_at timestamptz not null,
  document_url text not null,
  content_sha256 text,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique(document_type, version)
);
create unique index if not exists legal_document_one_current_per_type on public.legal_document_versions(document_type) where is_current;

create table if not exists public.user_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version_id uuid not null references public.legal_document_versions(id),
  privacy_version_id uuid not null references public.legal_document_versions(id),
  accepted_at timestamptz not null default now(),
  acceptance_context text not null check (acceptance_context in ('signup','existing_account','reauth','policy_update')),
  acceptance_method text not null default 'clickwrap',
  user_agent text,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index if not exists user_legal_acceptances_user_time_idx on public.user_legal_acceptances(user_id, accepted_at desc);

alter table public.legal_document_versions enable row level security;
alter table public.user_legal_acceptances enable row level security;

create policy "authenticated can read legal versions" on public.legal_document_versions for select to authenticated using (true);
create policy "users can read own legal acceptances" on public.user_legal_acceptances for select to authenticated using (user_id = auth.uid());

create or replace function public.current_legal_documents()
returns table(terms_version_id uuid, terms_version text, terms_url text, privacy_version_id uuid, privacy_version text, privacy_url text)
language sql stable security definer set search_path = ''
as $$
 select t.id,t.version,t.document_url,p.id,p.version,p.document_url
 from public.legal_document_versions t cross join public.legal_document_versions p
 where t.document_type='terms_of_service' and t.is_current
   and p.document_type='privacy_policy' and p.is_current
 limit 1
$$;

create or replace function public.has_current_legal_acceptance(target_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = ''
as $$
 select exists(
   select 1
   from public.user_legal_acceptances a
   join public.legal_document_versions t on t.id=a.terms_version_id and t.document_type='terms_of_service' and t.is_current
   join public.legal_document_versions p on p.id=a.privacy_version_id and p.document_type='privacy_policy' and p.is_current
   where a.user_id=target_user_id and target_user_id=auth.uid()
 )
$$;

create or replace function public.accept_current_legal_documents(acceptance_context text, acceptance_method text default 'clickwrap', client_user_agent text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare t_id uuid; p_id uuid; acceptance_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if acceptance_context not in ('signup','existing_account','reauth','policy_update') then raise exception 'Invalid acceptance context'; end if;
 select id into t_id from public.legal_document_versions where document_type='terms_of_service' and is_current limit 1;
 select id into p_id from public.legal_document_versions where document_type='privacy_policy' and is_current limit 1;
 if t_id is null or p_id is null then raise exception 'Current legal documents are not configured'; end if;
 insert into public.user_legal_acceptances(user_id,terms_version_id,privacy_version_id,acceptance_context,acceptance_method,user_agent)
 values(auth.uid(),t_id,p_id,acceptance_context,coalesce(nullif(acceptance_method,''),'clickwrap'),client_user_agent)
 returning id into acceptance_id;
 return acceptance_id;
end
$$;

revoke all on function public.current_legal_documents() from public;
revoke all on function public.has_current_legal_acceptance(uuid) from public;
revoke all on function public.accept_current_legal_documents(text,text,text) from public;
grant execute on function public.current_legal_documents() to authenticated;
grant execute on function public.has_current_legal_acceptance(uuid) to authenticated;
grant execute on function public.accept_current_legal_documents(text,text,text) to authenticated;