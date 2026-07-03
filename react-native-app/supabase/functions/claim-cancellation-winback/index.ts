/**
 * POST /functions/v1/claim-cancellation-winback
 * Body: { rcAppUserId, platform, isTrial, productId?, forfeit? }
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {
  forfeitCancellationWinback,
  getOrCreateEpoch,
  reserveCancellationWinback,
  type CancellationOfferTier,
} from '../_shared/cancellationWinback.ts';

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
    platform?: string;
    isTrial?: boolean;
    productId?: string;
    forfeit?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ok: false, error: 'Invalid JSON body.'}, 400);
  }

  const rcAppUserId = (body.rcAppUserId ?? '').trim();
  const platform = (body.platform ?? '').trim();
  const isTrial = body.isTrial === true;
  const productId = (body.productId ?? '').trim() || null;

  if (rcAppUserId.length === 0) {
    return json({ok: false, error: 'Could not identify your account.'}, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const epochId = await getOrCreateEpoch(sb, rcAppUserId, productId);

  if (body.forfeit === true) {
    const offerTier: CancellationOfferTier = isTrial ? 'trial_1_month' : 'paid_3_month';
    await forfeitCancellationWinback(sb, rcAppUserId, epochId, offerTier);
    return json({ok: true, forfeited: true, epochId});
  }

  const result = await reserveCancellationWinback(sb, rcAppUserId, platform, isTrial, productId);
  if (!result.ok) {
    return json({ok: false, error: result.error, eligible: false}, result.status ?? 400);
  }

  return json({
    ok: true,
    eligible: true,
    code: result.row.code,
    store: result.row.store,
    redeemUrl: result.row.redeemUrl,
    rewardTier: result.row.rewardTier,
    offerTier: result.row.offerTier,
    epochId: result.row.epochId,
    status: result.row.status,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
