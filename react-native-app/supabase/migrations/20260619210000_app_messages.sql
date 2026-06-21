-- In-app messages (beta requests, feedback) — reviewed before promo grant.

create table public.app_messages (
  id            uuid primary key default gen_random_uuid(),
  to_recipient  text not null,
  subject       text not null,
  message       text not null,
  category      text not null,
  from_email    text,
  rc_user_id    text,
  referral_code text,
  platform      text,
  app_version   text,
  status        text not null default 'pending',
  created_at    timestamptz not null default now()
);

alter table public.app_messages enable row level security;
grant all on public.app_messages to service_role;

create index app_messages_rc_user_id_idx on public.app_messages (rc_user_id);
create index app_messages_category_status_idx on public.app_messages (category, status);
