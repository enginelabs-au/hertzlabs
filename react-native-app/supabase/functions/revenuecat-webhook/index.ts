/**
 * POST /functions/v1/revenuecat-webhook
 *
 * Referrer purchase-upgrade bonus: when a referred user upgrades paid tier,
 * grant referrer an extra 1_month store offer code.
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {
  allocateReferralReward,
  isUpgradePath,
  productRank,
} from '../_shared/referralRewards.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_AUTH = Deno.env.get('RC_WEBHOOK_AUTH') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RcEvent = {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  period_type?: string;
  store?: string;
  subscriber_attributes?: Record<string, {value?: string}>;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: CORS});
  }
  if (req.method !== 'POST') {
    return json({ok: false}, 405);
  }

  if (WEBHOOK_AUTH.length > 0) {
    const auth = req.headers.get('Authorization') ?? '';
    if (auth !== `Bearer ${WEBHOOK_AUTH}`) {
      return json({ok: false, error: 'Unauthorized.'}, 401);
    }
  }

  let payload: {event?: RcEvent};
  try {
    payload = await req.json();
  } catch {
    return json({ok: false, error: 'Invalid JSON.'}, 400);
  }

  const event = payload.event;
  if (event?.app_user_id == null) {
    return json({ok: true, skipped: 'no user'});
  }

  const eventType = event.type ?? '';
  if (
    eventType !== 'INITIAL_PURCHASE' &&
    eventType !== 'PRODUCT_CHANGE' &&
    eventType !== 'RENEWAL'
  ) {
    return json({ok: true, skipped: eventType});
  }

  const refereeRcId = event.app_user_id.trim();
  const nextProductId = event.product_id ?? null;
  const nextPeriodType = event.period_type ?? null;
  const platform = mapRcStore(event.store);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const {data: redemption} = await sb
    .from('referral_redemptions')
    .select('referrer_code, referrer_rc_id')
    .eq('referee_rc_id', refereeRcId)
    .maybeSingle();

  if (redemption == null) {
    return json({ok: true, skipped: 'not referred'});
  }

  const {data: tracked} = await sb
    .from('referral_referee_products')
    .select('product_id, period_type')
    .eq('referee_rc_id', refereeRcId)
    .maybeSingle();

  const prevProductId = (tracked?.product_id as string | null) ?? null;
  const prevRank = productRank(prevProductId);
  const nextRank = productRank(nextProductId);

  await sb.from('referral_referee_products').upsert(
    {
      referee_rc_id: refereeRcId,
      referrer_code: redemption.referrer_code,
      referrer_rc_id: redemption.referrer_rc_id,
      product_id: nextProductId,
      period_type: nextPeriodType,
      updated_at: new Date().toISOString(),
    },
    {onConflict: 'referee_rc_id'},
  );

  const isPaidUpgrade =
    (eventType === 'INITIAL_PURCHASE' && nextPeriodType !== 'TRIAL' && nextRank > 0) ||
    (eventType === 'PRODUCT_CHANGE' && isUpgradePath(prevProductId, nextProductId));

  if (!isPaidUpgrade || prevRank >= nextRank) {
    return json({ok: true, skipped: 'not upgrade'});
  }

  const rewardKey = `${nextProductId ?? 'unknown'}:${Date.now()}`;
  const referrerRcId = redemption.referrer_rc_id as string;

  const result = await allocateReferralReward(
    sb,
    'refer_purchase_upgrade',
    platform,
    referrerRcId,
    rewardKey,
    '1_month',
  );

  if (!result.ok) {
    console.error('[revenuecat-webhook] upgrade bonus failed:', result.error);
    return json({ok: false, error: result.error}, result.status ?? 500);
  }

  return json({ok: true, granted: true, code: result.claim.code});
});

function mapRcStore(store: string | undefined): string {
  if (store === 'PLAY_STORE') {
    return 'android';
  }
  return 'ios';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
