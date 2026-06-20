-- Allow relaunching the welcome Premium campaign (one claim per rc_user_id per campaign).

alter table public.welcome_premium_grants
  add column if not exists campaign text not null default 'welcome_v1';

alter table public.welcome_premium_grants
  drop constraint if exists welcome_premium_grants_rc_user_id_key;

create unique index if not exists welcome_premium_grants_rc_user_campaign
  on public.welcome_premium_grants (rc_user_id, campaign);
