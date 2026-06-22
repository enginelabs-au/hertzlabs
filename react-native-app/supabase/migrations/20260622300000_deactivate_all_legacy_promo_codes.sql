-- Fully retire custom promo_codes table (HLP + HZDEV). Rewards use store_offer_code_pool only.

update public.promo_codes
set active = false
where active is distinct from false;
