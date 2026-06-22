-- Service role needs delete for promo test reset script and admin tooling.

grant delete on public.wellness_checkins to service_role;
grant delete on public.promo_reward_claims to service_role;
grant delete on public.referrer_profiles to service_role;
grant delete on public.post_submissions to service_role;
grant delete on public.practitioner_applications to service_role;
grant delete on public.app_messages to service_role;
grant delete on public.promo_redemptions to service_role;
