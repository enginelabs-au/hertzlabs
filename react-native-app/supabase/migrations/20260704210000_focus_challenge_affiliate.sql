-- Feature 18: 30-day focus challenge progress (server-backed).
-- Feature 20: affiliate application ledger.

create table if not exists public.focus_challenge_progress (
  id uuid primary key default gen_random_uuid(),
  rc_user_id text not null,
  attempt_id text not null,
  status text not null default 'active'
    check (status in ('active', 'failed', 'complete')),
  current_day int not null default 1 check (current_day >= 1 and current_day <= 30),
  last_completed_date date,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  reward_claimed_at timestamptz,
  unique (rc_user_id, attempt_id)
);

create index if not exists focus_challenge_progress_rc_idx
  on public.focus_challenge_progress (rc_user_id, status);

alter table public.focus_challenge_progress enable row level security;
grant select, insert, update, delete on public.focus_challenge_progress to service_role;

create table if not exists public.affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  message text not null,
  rc_user_id text,
  platform text,
  app_version text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists affiliate_applications_email_idx
  on public.affiliate_applications (email, created_at desc);

alter table public.affiliate_applications enable row level security;
grant select, insert, update, delete on public.affiliate_applications to service_role;
