-- Weekly wellness check-ins (mood / sleep / focus) for Promos reward + analytics.

create table if not exists public.wellness_checkins (
  id            uuid primary key default gen_random_uuid(),
  rc_user_id    text not null,
  mood          smallint not null check (mood between 1 and 10),
  sleep_quality smallint not null check (sleep_quality between 1 and 10),
  focus_level   smallint not null check (focus_level between 1 and 10),
  platform      text,
  app_version   text,
  submitted_at  timestamptz not null default now()
);

create index if not exists wellness_checkins_rc_user_submitted_idx
  on public.wellness_checkins (rc_user_id, submitted_at desc);

alter table public.wellness_checkins enable row level security;
