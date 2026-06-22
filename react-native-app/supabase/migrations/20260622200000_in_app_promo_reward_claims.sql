-- In-app promo rewards (streak, review, referral, etc.) — store offer code claims.
-- Legacy HLP promo_codes are retired; rewards come from store_offer_code_pool.

create table if not exists public.referrer_profiles (
  referrer_code text primary key,
  rc_user_id text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_referrer_profiles_rc_user
  on public.referrer_profiles (rc_user_id);

alter table public.referrer_profiles enable row level security;

create table if not exists public.promo_reward_claims (
  id uuid primary key default gen_random_uuid(),
  rc_user_id text not null,
  reward_type text not null,
  reward_key text not null default '',
  store_offer_code_id uuid references public.store_offer_code_pool (id),
  code text not null,
  store text not null check (store in ('apple', 'google')),
  reward_tier text not null check (reward_tier in ('1_month', '3_month')),
  created_at timestamptz not null default now(),
  unique (rc_user_id, reward_type, reward_key)
);

create index if not exists idx_promo_reward_claims_rc_user
  on public.promo_reward_claims (rc_user_id, reward_type);

alter table public.promo_reward_claims enable row level security;

-- Retire legacy HLP custom codes (App Store / Play offer codes only).
update public.promo_codes
set active = false
where code like 'HLP-%';

grant select, insert, update, delete on public.referrer_profiles to service_role;
grant select, insert, update, delete on public.promo_reward_claims to service_role;
