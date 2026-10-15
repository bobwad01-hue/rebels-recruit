alter table public.interactions
  add column if not exists gmail_recipient_email text;
comment on column public.interactions.gmail_recipient_email is
  'Exact To recipient used for a Gmail send, including an athlete-scoped address; preserves proof if their personal address is later changed.';
