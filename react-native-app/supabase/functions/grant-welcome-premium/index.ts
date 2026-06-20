/**
 * Hertz Labs — grant-welcome-premium edge function
 *
 * POST /functions/v1/grant-welcome-premium
 * Body: { rcAppUserId: string, campaign?: string }
 *
 * Grants a one-time 7-day promotional Premium entitlement via RevenueCat v2 API.
 * Extends existing Premium by 7 days when the user already has access.
 * Each RC app user id may claim once per campaign.
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {grantRcPremiumForMs, RC_GRANT_DURATIONS_MS} from '../_shared/rcGrant.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const DEFAULT_CAMPAIGN = '202606_v2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: CORS});
  }

  if (req.method !== 'POST') {
    return json({ok: false, error: 'Method not allowed.'}, 405);
  }

  let body: {rcAppUserId?: string; campaign?: string};
  try {
    body = await req.json();
  } catch {
    return json({ok: false, error: 'Invalid JSON body.'}, 400);
  }

  const rcAppUserId = (body.rcAppUserId ?? '').trim();
  const campaign = (body.campaign ?? DEFAULT_CAMPAIGN).trim() || DEFAULT_CAMPAIGN;

  if (rcAppUserId.length === 0) {
    return json({ok: false, error: 'Could not identify your account. Please try again.'}, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const {data: existing} = await sb
    .from('welcome_premium_grants')
    .select('id')
    .eq('rc_user_id', rcAppUserId)
    .eq('campaign', campaign)
    .maybeSingle();

  if (existing != null) {
    return json({
      ok: true,
      message: 'Welcome Premium is already active on this account.',
      alreadyClaimed: true,
    });
  }

  const grant = await grantRcPremiumForMs(rcAppUserId, RC_GRANT_DURATIONS_MS.weekly);
  if (!grant.ok) {
    return json({ok: false, error: grant.error}, grant.status ?? 502);
  }

  const {error: insertErr} = await sb.from('welcome_premium_grants').insert({
    rc_user_id: rcAppUserId,
    campaign,
  });
  if (insertErr != null) {
    console.error('[grant-welcome-premium] insert failed:', insertErr.message);
    return json({ok: false, error: 'Could not record activation — contact support if Premium is missing.'}, 500);
  }

  return json({
    ok: true,
    message: 'Premium activated — 7 complimentary days added to your account.',
    expiresAtMs: grant.expiresAtMs,
    extendedExisting: grant.expiresAtMs > Date.now() + RC_GRANT_DURATIONS_MS.weekly,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
