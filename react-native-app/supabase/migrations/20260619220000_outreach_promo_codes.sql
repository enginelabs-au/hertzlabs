-- Outreach follow-up promo codes (admin copy-paste into reply emails).
-- Codes are also referenced in supabase/functions/_shared/outreachPromo.ts

insert into public.promo_codes (code, entitlement, label, description, max_uses, active)
values
  (
    'HLP-K7M2-R9NX',
    'one_month',
    '1 Month Premium',
    'One month of Hertz Labs Premium — Make a Post reward.',
    null,
    true
  ),
  (
    'HLP-P3Q8-W4VT',
    'extended_trial',
    '3-Month Premium',
    'Three months of Hertz Labs Premium — practitioner / therapist reward.',
    null,
    true
  ),
  (
    'HLP-B6H9-N2JC',
    'one_month',
    '1 Month Premium',
    'One month of Hertz Labs Premium — beta testing reward.',
    null,
    true
  )
on conflict (code) do update set
  entitlement = excluded.entitlement,
  label = excluded.label,
  description = excluded.description,
  max_uses = excluded.max_uses,
  active = excluded.active;
