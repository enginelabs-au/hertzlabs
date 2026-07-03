-- Cancellation winback allocations + epoch tracking (Feature 16).

create table if not exists public.cancellation_epochs (
  rc_user_id text primary key,
  epoch_id integer not null default 1,
  last_product_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.cancellation_winback_allocations (
  id uuid primary key default gen_random_uuid(),
  rc_user_id text not null,
  epoch_id integer not null,
  offer_tier text not null check (offer_tier in ('trial_1_month', 'paid_3_month')),
  store text not null check (store in ('apple', 'google')),
  store_offer_code_id uuid references public.store_offer_code_pool (id),
  code text not null,
  reward_tier text not null check (reward_tier in ('1_month', '3_month')),
  status text not null default 'reserved'
    check (status in ('reserved', 'redeemed', 'forfeited')),
  product_id_at_allocation text,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  unique (rc_user_id, epoch_id, offer_tier)
);

create index if not exists idx_cancellation_winback_rc_user
  on public.cancellation_winback_allocations (rc_user_id, epoch_id);

alter table public.cancellation_epochs enable row level security;
alter table public.cancellation_winback_allocations enable row level security;

grant select, insert, update, delete on public.cancellation_epochs to service_role;
grant select, insert, update, delete on public.cancellation_winback_allocations to service_role;

-- Lapsed-user winback grants (Feature 19).
create table if not exists public.lapsed_winback_grants (
  id uuid primary key default gen_random_uuid(),
  rc_user_id text not null,
  campaign text not null check (campaign in ('inactive_7', 'inactive_30')),
  store_offer_code_id uuid references public.store_offer_code_pool (id),
  code text,
  store text check (store in ('apple', 'google')),
  status text not null default 'offered'
    check (status in ('offered', 'claimed', 'declined')),
  offered_at timestamptz not null default now(),
  unique (rc_user_id, campaign)
);

alter table public.lapsed_winback_grants enable row level security;
grant select, insert, update, delete on public.lapsed_winback_grants to service_role;
