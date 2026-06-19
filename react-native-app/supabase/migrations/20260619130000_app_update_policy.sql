-- Minimum app version per platform. Set force_update = true only when an update is mandatory.

create table if not exists public.app_update_policy (
  platform          text primary key check (platform in ('ios', 'android')),
  min_version_code  integer not null default 1,
  force_update      boolean not null default false,
  updated_at        timestamptz not null default now()
);

alter table public.app_update_policy enable row level security;

grant select on public.app_update_policy to service_role;

insert into public.app_update_policy (platform, min_version_code, force_update) values
  ('ios', 1, false),
  ('android', 1, false)
on conflict (platform) do nothing;
