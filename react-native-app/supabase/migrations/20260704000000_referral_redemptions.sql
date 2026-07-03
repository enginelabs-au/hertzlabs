-- v3 manual referral redemptions (Issue 8)

create table if not exists public.referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  referrer_code text not null references public.referrer_profiles (referrer_code),
  referee_rc_id text not null,
  referrer_rc_id text not null,
  redemption_index integer not null check (redemption_index > 0),
  platform text,
  created_at timestamptz not null default now(),
  unique (referee_rc_id)
);

create index if not exists idx_referral_redemptions_referrer_code
  on public.referral_redemptions (referrer_code);

create index if not exists idx_referral_redemptions_referrer_rc
  on public.referral_redemptions (referrer_rc_id);

alter table public.referral_redemptions enable row level security;

-- Track referee subscription product for upgrade-bonus detection (RC webhook).
create table if not exists public.referral_referee_products (
  referee_rc_id text primary key,
  referrer_code text not null,
  referrer_rc_id text not null,
  product_id text,
  period_type text,
  updated_at timestamptz not null default now()
);

alter table public.referral_referee_products enable row level security;

-- Aggregated referrer stats for ops / BI.
create or replace view public.referral_stats_by_code as
select
  rr.referrer_code,
  count(*)::int as total_redemptions,
  count(*) filter (where rr.redemption_index % 6 = 0)::int as milestone_3mo_count,
  count(*) filter (where rr.redemption_index % 6 <> 0)::int as standard_1mo_count,
  coalesce(upg.upgrade_bonus_count, 0)::int as purchase_upgrade_bonuses
from public.referral_redemptions rr
left join (
  select
    rp.referrer_code,
    count(*)::int as upgrade_bonus_count
  from public.promo_reward_claims prc
  join public.referrer_profiles rp on rp.rc_user_id = prc.rc_user_id
  where prc.reward_type = 'refer_purchase_upgrade'
  group by rp.referrer_code
) upg on upg.referrer_code = rr.referrer_code
group by rr.referrer_code, upg.upgrade_bonus_count;

grant select, insert, update, delete on public.referral_redemptions to service_role;
grant select, insert, update, delete on public.referral_referee_products to service_role;
grant select on public.referral_stats_by_code to service_role;
