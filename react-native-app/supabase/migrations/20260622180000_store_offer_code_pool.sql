-- Pool of App Store / Google Play offer codes (imported from ASC / Play Console CSV exports).
-- Allocated atomically when outreach submissions arrive.

create table if not exists public.store_offer_code_pool (
  id uuid primary key default gen_random_uuid(),
  store text not null check (store in ('apple', 'google')),
  reward_tier text not null check (reward_tier in ('1_month', '3_month')),
  code text not null,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'assigned', 'void')),
  batch_label text,
  submission_type text,
  submission_id uuid,
  rc_user_id text,
  reserved_at timestamptz,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  unique (store, code)
);

create index if not exists idx_store_offer_code_pool_pick
  on public.store_offer_code_pool (store, reward_tier, status, created_at);

alter table public.store_offer_code_pool enable row level security;

-- Atomically reserve the oldest available code (service role only).
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

revoke all on function public.allocate_store_offer_code from public;
grant execute on function public.allocate_store_offer_code to service_role;

revoke all on function public.count_available_store_offer_codes from public;
grant execute on function public.count_available_store_offer_codes to service_role;
