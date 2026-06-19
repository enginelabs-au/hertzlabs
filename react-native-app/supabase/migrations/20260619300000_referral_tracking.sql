-- Referral click + install attribution (Branch-free).

create table public.referral_clicks (
  id            uuid primary key default gen_random_uuid(),
  referrer_code text not null,
  user_agent    text,
  platform      text,
  created_at    timestamptz not null default now()
);

create table public.referral_installs (
  id             uuid primary key default gen_random_uuid(),
  referrer_code  text not null,
  referee_id     text,
  created_at     timestamptz not null default now(),
  unique (referrer_code, referee_id)
);

alter table public.referral_clicks enable row level security;
alter table public.referral_installs enable row level security;

grant all on public.referral_clicks to service_role;
grant all on public.referral_installs to service_role;
