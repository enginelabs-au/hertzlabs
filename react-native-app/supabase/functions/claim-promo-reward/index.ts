/**
 * POST /functions/v1/claim-promo-reward
 * Body: { rcAppUserId, rewardType, platform, rewardKey? }
 *
 * Allocates a store offer code from store_offer_code_pool for in-app rewards.
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {
  allocateInAppReward,
  isInAppRewardType,
  pendingReferInstallClaims,
} from '../_shared/inAppPromoRewards.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

  let body: {
    rcAppUserId?: string;
    rewardType?: string;
    platform?: string;
    rewardKey?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ok: false, error: 'Invalid JSON body.'}, 400);
  }

  const rcAppUserId = (body.rcAppUserId ?? '').trim();
  const rewardType = (body.rewardType ?? '').trim();
  const platform = (body.platform ?? '').trim();
  const rewardKey = String(body.rewardKey ?? '').trim();

  if (rcAppUserId.length === 0) {
    return json({ok: false, error: 'Could not identify your account. Please try again.'}, 400);
  }
  if (!isInAppRewardType(rewardType)) {
    return json({ok: false, error: 'Invalid reward type.'}, 400);
  }
  if (rewardType === 'streak_bonus' && rewardKey.length === 0) {
    return json({ok: false, error: 'Missing streak milestone.'}, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const result = await allocateInAppReward(sb, rewardType, platform, rcAppUserId, rewardKey);

  if (!result.ok) {
    return json({ok: false, error: result.error}, result.status ?? 400);
  }

  const pendingReferrals = await pendingReferInstallClaims(sb, rcAppUserId);

  return json({
    ok: true,
    code: result.claim.code,
    store: result.claim.store,
    rewardTier: result.claim.rewardTier,
    redeemUrl: result.claim.redeemUrl,
    pendingReferInstallClaims: pendingReferrals,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
