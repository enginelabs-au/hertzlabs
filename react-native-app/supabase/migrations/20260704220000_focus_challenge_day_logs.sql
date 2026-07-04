-- F18: per-day reflection logs for focus challenge.

create table if not exists public.focus_challenge_day_logs (
  id uuid primary key default gen_random_uuid(),
  rc_user_id text not null,
  attempt_id text not null,
  day_index int not null check (day_index >= 1 and day_index <= 30),
  duration_played_sec int not null default 0,
  reflection_json jsonb,
  completed_date date not null,
  created_at timestamptz not null default now(),
  unique (rc_user_id, attempt_id, day_index)
);

create index if not exists focus_challenge_day_logs_rc_idx
  on public.focus_challenge_day_logs (rc_user_id, attempt_id);

alter table public.focus_challenge_day_logs enable row level security;
grant select, insert, update, delete on public.focus_challenge_day_logs to service_role;
