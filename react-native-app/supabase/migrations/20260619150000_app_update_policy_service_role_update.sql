-- Edge function auto-clear needs write access (RLS enabled, only SELECT was granted).

grant update on public.app_update_policy to service_role;
