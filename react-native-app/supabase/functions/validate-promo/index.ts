/**
 * Hertz Labs — validate-promo edge function
 *
 * POST /functions/v1/validate-promo
 * Body: { code: string, rcAppUserId: string }
 *
 * 200: { valid: true, entitlement, label, description }
 * 4xx: { valid: false, error: string }
 *
 * Uses Supabase service role to read/write promo_codes and promo_redemptions.
 * Calls the RevenueCat REST API to grant the entitlement for trial/lifetime codes.
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {grantRcPremiumForMs, RC_GRANT_DURATIONS_MS} from '../_shared/rcGrant.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RC_GRANT_MS: Record<string, number> = {
  extended_trial: RC_GRANT_DURATIONS_MS.threeMonth,
  lifetime: RC_GRANT_DURATIONS_MS.lifetime,
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: CORS});
  }

  if (req.method !== 'POST') {
    return json({valid: false, error: 'Method not allowed.'}, 405);
  }

  let body: {code?: string; rcAppUserId?: string};
  try {
    body = await req.json();
  } catch {
    return json({valid: false, error: 'Invalid JSON body.'}, 400);
  }

  const code = (body.code ?? '').toUpperCase().trim();
  const rcAppUserId = (body.rcAppUserId ?? '').trim();

  if (code.length < 4) {
    return json({valid: false, error: 'Code is too short.'}, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Look up the promo code
  const {data: promo, error: promoErr} = await sb
    .from('promo_codes')
    .select('*')
    .eq('code', code)
    .single();

  if (promoErr != null || promo == null) {
    return json({valid: false, error: 'Code not found or already used.'}, 404);
  }

  // 2. Reject deactivated codes (manually retired or auto-deactivated after max uses)
  if (promo.active === false) {
    return json({valid: false, error: 'This code is no longer active.'}, 410);
  }

  // 3. Check expiry
  if (promo.expires_at != null && new Date(promo.expires_at) < new Date()) {
    return json({valid: false, error: 'This code has expired.'}, 410);
  }

  // 4. Check use limit (belt-and-suspenders alongside the trigger)
  if (promo.max_uses != null && promo.use_count >= promo.max_uses) {
    return json({valid: false, error: 'This code has reached its redemption limit.'}, 410);
  }

  // 4. Check duplicate redemption by this RC user
  if (rcAppUserId.length > 0) {
    const {data: existing} = await sb
      .from('promo_redemptions')
      .select('id')
      .eq('code', code)
      .eq('rc_user_id', rcAppUserId)
      .single();

    if (existing != null) {
      return json({valid: false, error: 'You have already redeemed this code.'}, 409);
    }
  }

  // 5. For trial/lifetime: grant RC promotional entitlement (v2 API)
  if (promo.entitlement === 'extended_trial' || promo.entitlement === 'lifetime') {
    if (rcAppUserId.length === 0) {
      return json({valid: false, error: 'Could not identify your account. Please sign in and try again.'}, 400);
    }

    const durationMs = RC_GRANT_MS[promo.entitlement];
    const grant = await grantRcPremiumForMs(rcAppUserId, durationMs);
    if (!grant.ok) {
      return json({valid: false, error: grant.error}, grant.status ?? 502);
    }
  }

  // 6. Record redemption and increment use_count.
  // The database trigger auto-sets active=false when use_count reaches max_uses.
  await sb.from('promo_redemptions').insert({
    code,
    rc_user_id: rcAppUserId.length > 0 ? rcAppUserId : 'anonymous',
  });

  await sb
    .from('promo_codes')
    .update({use_count: promo.use_count + 1})
    .eq('code', code);

  return json({
    valid: true,
    entitlement: clientEntitlement(promo.entitlement),
    label: promo.label,
    description: promo.description,
  });
});

/** Legacy app builds expect discount_20 / discount_50 in the JSON response. */
function clientEntitlement(entitlement: string): string {
  switch (entitlement) {
    case 'discount_2mo':
      return 'discount_20';
    case 'discount_6mo':
      return 'discount_50';
    default:
      return entitlement;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
