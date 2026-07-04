-- Remove F17 lifetime_free tier — ASC/Play minimum code batches (~500) make small capped grants non-viable.

delete from public.store_offer_code_pool where reward_tier = 'lifetime_free';

alter table public.store_offer_code_pool
  drop constraint if exists store_offer_code_pool_reward_tier_check;

alter table public.store_offer_code_pool
  add constraint store_offer_code_pool_reward_tier_check
  check (reward_tier in ('1_month', '3_month'));

alter table public.promo_reward_claims
  drop constraint if exists promo_reward_claims_reward_tier_check;

alter table public.promo_reward_claims
  add constraint promo_reward_claims_reward_tier_check
  check (reward_tier in ('1_month', '3_month'));

drop table if exists public.foundation_lifetime_grants;

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
  if p_reward_tier not in ('1_month', '3_month') then
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
