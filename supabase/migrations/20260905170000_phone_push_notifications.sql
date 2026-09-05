create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions"
on public.push_subscriptions
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages boolean not null default true,
  tasks boolean not null default true,
  reminders boolean not null default true,
  advisor_activity boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "users manage own notification preferences" on public.notification_preferences;
create policy "users manage own notification preferences"
on public.notification_preferences
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.notification_preferences to authenticated;

alter table public.notifications
  add column if not exists kind text not null default 'general',
  add column if not exists url text,
  add column if not exists data jsonb,
  add column if not exists scheduled_for timestamptz not null default now(),
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_error text,
  add column if not exists dedupe_key text;

create unique index if not exists notifications_user_dedupe_key_idx
on public.notifications(user_id, dedupe_key)
where dedupe_key is not null;

create index if not exists notifications_push_queue_idx
on public.notifications(scheduled_for, push_sent_at)
where push_sent_at is null;

create or replace function private.queue_push_worker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  function_url text;
  cron_secret text;
begin
  select decrypted_secret into function_url
  from vault.decrypted_secrets
  where name = 'rebels_notification_function_url'
  limit 1;

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'rebels_notification_cron_secret'
  limit 1;

  if function_url is null or cron_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-rebels-cron-secret', cron_secret
    ),
    timeout_milliseconds := 2000
  );

  return new;
exception when others then
  return new;
end;
$$;

create or replace function private.queue_message_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_user_id uuid;
  preview text;
begin
  preview := left(regexp_replace(coalesce(new.body, ''), E'\\s+', ' ', 'g'), 140);

  for member_user_id in
    select user_id
    from public.advisor_conversation_members
    where conversation_id = new.conversation_id
      and user_id <> new.sender_user_id
  loop
    insert into public.notifications(user_id, title, body, kind, url, data, dedupe_key)
    values (
      member_user_id,
      'New message',
      case when preview = '' then 'You have a new recruiting message.' else preview end,
      'message',
      '/messages',
      jsonb_build_object('conversation_id', new.conversation_id),
      'message:' || new.id::text || ':' || member_user_id::text
    )
    on conflict (user_id, dedupe_key) do nothing;
  end loop;

  return new;
end;
$$;

create or replace function private.queue_task_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to_user_id is not null and
     (tg_op = 'INSERT' or old.assigned_to_user_id is distinct from new.assigned_to_user_id) then
    insert into public.notifications(user_id, title, body, kind, url, data, dedupe_key)
    values (
      new.assigned_to_user_id,
      'New recruiting task',
      new.title,
      'task',
      '/advisors/tasks',
      jsonb_build_object('task_id', new.id),
      'task:' || new.id::text || ':' || new.assigned_to_user_id::text
    )
    on conflict (user_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

create or replace function private.queue_advisor_invitation_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications(user_id, title, body, kind, url, data, dedupe_key)
    values (
      new.athlete_user_id,
      'New advisor invitation',
      'A recruiting advisor wants access to your Rebels Recruit account.',
      'advisor_activity',
      '/dashboard',
      jsonb_build_object('assignment_id', new.id),
      'advisor-invite:' || new.id::text
    )
    on conflict (user_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

create or replace function private.queue_reminder_created_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_user_id is not null and new.status = 'open' and new.due_date <= current_date then
    insert into public.notifications(user_id, title, body, kind, url, data, dedupe_key)
    values (
      new.owner_user_id,
      case when new.due_date < current_date then 'Overdue recruiting reminder' else 'Recruiting reminder due today' end,
      new.title,
      'reminder',
      '/reminders',
      jsonb_build_object('reminder_id', new.id),
      'reminder-due:' || new.id::text || ':' || new.due_date::text
    )
    on conflict (user_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists advisor_messages_push_notification on public.advisor_messages;
create trigger advisor_messages_push_notification
after insert on public.advisor_messages
for each row execute function private.queue_message_notifications();

drop trigger if exists advisor_tasks_push_notification on public.advisor_tasks;
create trigger advisor_tasks_push_notification
after insert or update of assigned_to_user_id on public.advisor_tasks
for each row execute function private.queue_task_notifications();

drop trigger if exists advisor_invitation_push_notification on public.athlete_advisor_assignments;
create trigger advisor_invitation_push_notification
after insert on public.athlete_advisor_assignments
for each row execute function private.queue_advisor_invitation_notification();

drop trigger if exists reminder_due_push_notification on public.reminders;
create trigger reminder_due_push_notification
after insert on public.reminders
for each row execute function private.queue_reminder_created_notification();

drop trigger if exists notification_push_worker on public.notifications;
create trigger notification_push_worker
after insert on public.notifications
for each row execute function private.queue_push_worker();

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'rebels-recruit-notification-worker') then
    perform cron.schedule(
      'rebels-recruit-notification-worker',
      '* * * * *',
      $cron$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'rebels_notification_function_url' limit 1),
          body := jsonb_build_object('scheduled', true, 'at', now()),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-rebels-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'rebels_notification_cron_secret' limit 1)
          ),
          timeout_milliseconds := 2000
        ) as request_id;
      $cron$
    );
  end if;
end $$;
