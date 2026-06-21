-- Rename discount promo entitlements from legacy 20/50 model to 2mo/6mo.
-- Promo code strings are rotated to random values via scripts/rotate-promo-codes.mjs.

update public.promo_codes
set
  entitlement = 'discount_2mo',
  label = '2 Months Free',
  description = 'Two free months on any Hertz Labs subscription plan.'
where entitlement = 'discount_20';

update public.promo_codes
set
  entitlement = 'discount_6mo',
  label = '6 Months Free',
  description = 'Six free months on any Hertz Labs subscription plan.'
where entitlement = 'discount_50';

-- Retire guessable dev discount codes (replaced by script with random HLP-* codes).
update public.promo_codes
set active = false
where code in ('HZDEV-20OFF', 'HZDEV-50OFF');
