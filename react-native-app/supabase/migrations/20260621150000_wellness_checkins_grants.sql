-- Edge functions use the service_role key; grant table access explicitly.

grant select, insert on public.wellness_checkins to service_role;
