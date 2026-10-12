alter table public.interactions
  add column if not exists gmail_message_id text,
  add column if not exists gmail_thread_id text,
  add column if not exists gmail_sender_email text;

comment on column public.interactions.gmail_message_id is 'Gmail API message ID returned after a successful send; null for historical/manual activity.';
comment on column public.interactions.gmail_thread_id is 'Gmail API thread ID returned after a successful send.';
comment on column public.interactions.gmail_sender_email is 'Google account that sent this email, used for the View in Gmail link.';
