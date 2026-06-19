-- Promo codes table for Hertz Labs
-- Each row is one promo "slot" that can be redeemed.
-- max_uses = null means single-use.

create table public.promo_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,            -- normalised UPPER TRIM
  entitlement text not null,                   -- 'extended_trial' | 'lifetime' | 'discount_20' | 'discount_50'
  label       text not null,
  description text not null,
  max_uses    integer,                         -- null = single use
  use_count   integer not null default 0,
  expires_at  timestamptz,                     -- null = never expires
  created_at  timestamptz not null default now()
);

-- Redemption log so we can detect duplicate attempts per device/user
create table public.promo_redemptions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null references public.promo_codes(code),
  rc_user_id  text not null,
  redeemed_at timestamptz not null default now(),
  unique (code, rc_user_id)                    -- one redemption per user per code
);

-- Row-level security: only the edge function (service role) touches these
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

-- Seed dev/test codes (remove before production launch)
insert into public.promo_codes (code, entitlement, label, description, max_uses) values
  ('HZDEV-TRIAL',  'extended_trial', '3-Month Trial',    'Enjoy 3 months of Hertz Labs Premium free.', 100),
  ('HZDEV-LIFE',   'lifetime',       'Lifetime Premium', 'Lifetime Hertz Labs Premium access.',        10),
  ('HZDEV-20OFF',  'discount_20',    '20% Discount',     '20% off all Hertz Labs plans.',              500),
  ('HZDEV-50OFF',  'discount_50',    '50% Discount',     '50% off all Hertz Labs plans.',              500);
