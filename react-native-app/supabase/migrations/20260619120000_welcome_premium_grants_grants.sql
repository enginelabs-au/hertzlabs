-- Edge function uses service_role; table was missing explicit grants.

grant all on public.welcome_premium_grants to service_role;
