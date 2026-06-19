-- One-time 7-day welcome premium grant per RevenueCat subscriber id.

create table if not exists public.welcome_premium_grants (
  id          uuid primary key default gen_random_uuid(),
  rc_user_id  text not null unique,
  granted_at  timestamptz not null default now()
);

alter table public.welcome_premium_grants enable row level security;
