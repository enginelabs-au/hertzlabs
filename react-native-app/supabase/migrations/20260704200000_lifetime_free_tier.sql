-- Feature 17: lifetime_free pool tier (manual ops only — no in-app claim path).

alter table public.store_offer_code_pool
  drop constraint if exists store_offer_code_pool_reward_tier_check;

alter table public.store_offer_code_pool
  add constraint store_offer_code_pool_reward_tier_check
  check (reward_tier in ('1_month', '3_month', 'lifetime_free'));

alter table public.promo_reward_claims
  drop constraint if exists promo_reward_claims_reward_tier_check;

alter table public.promo_reward_claims
  add constraint promo_reward_claims_reward_tier_check
  check (reward_tier in ('1_month', '3_month', 'lifetime_free'));

create or replace function public.allocate_store_offer_code(
  p_store text,
  p_reward_tier text,
  p_submission_type text,
  p_submission_id uuid default null,
  p_rc_user_id text default null
)
returns table(id uuid, code text, store text, reward_tier text)
language plpgsql
security definer
set search_path = public
as $$
declare
  picked uuid;
begin
  if p_store not in ('apple', 'google') then
    return;
  end if;
  if p_reward_tier not in ('1_month', '3_month', 'lifetime_free') then
    return;
  end if;

  select c.id into picked
  from public.store_offer_code_pool c
  where c.store = p_store
    and c.reward_tier = p_reward_tier
    and c.status = 'available'
  order by c.created_at asc
  limit 1
  for update skip locked;

  if picked is null then
    return;
  end if;

  update public.store_offer_code_pool c
  set
    status = 'reserved',
    submission_type = p_submission_type,
    submission_id = p_submission_id,
    rc_user_id = p_rc_user_id,
    reserved_at = now()
  where c.id = picked;

  return query
  select c.id, c.code, c.store, c.reward_tier
  from public.store_offer_code_pool c
  where c.id = picked;
end;
$$;

create table if not exists public.foundation_lifetime_grants (
  id uuid primary key default gen_random_uuid(),
  store_offer_code_id uuid references public.store_offer_code_pool(id),
  rc_user_id text,
  recipient_note text,
  submission_type text not null default 'foundation_lifetime',
  created_at timestamptz not null default now()
);

alter table public.foundation_lifetime_grants enable row level security;
grant select, insert, update, delete on public.foundation_lifetime_grants to service_role;

create or replace function public.count_available_store_offer_codes(
  p_store text,
  p_reward_tier text
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.store_offer_code_pool c
  where c.store = p_store
    and c.reward_tier = p_reward_tier
    and c.status = 'available';
$$;
