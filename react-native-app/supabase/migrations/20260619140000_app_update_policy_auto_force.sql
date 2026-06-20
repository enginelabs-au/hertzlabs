-- Target store build + auto-clear force once clients on latest check in.

alter table public.app_update_policy
  add column if not exists latest_version_code integer;

update public.app_update_policy
set
  min_version_code = greatest(coalesce(min_version_code, 1), 10),
  latest_version_code = greatest(
    coalesce(latest_version_code, min_version_code, 1),
    10
  ),
  force_update = true,
  updated_at = now()
where platform in ('ios', 'android');

alter table public.app_update_policy
  alter column latest_version_code set not null;

alter table public.app_update_policy
  alter column latest_version_code set default 1;
