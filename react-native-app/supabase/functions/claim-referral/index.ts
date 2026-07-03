/**
 * POST /functions/v1/claim-referral
 * Body: { rcAppUserId, referrerCode, platform }
 *
 * v3 manual referral: referee enters HZ code on Plans → tiered store offer rewards.
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {setRcCustomerAttributes} from '../_shared/rcAttributes.ts';
import {
  allocateReferralReward,
  countReferrerRedemptions,
  normalizeReferrerCode,
  refereeAlreadyRedeemed,
  referrerRewardTypeForTier,
  referrerTierForIndex,
} from '../_shared/referralRewards.ts';

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

  let body: {rcAppUserId?: string; referrerCode?: string; platform?: string};
  try {
    body = await req.json();
  } catch {
    return json({ok: false, error: 'Invalid JSON body.'}, 400);
  }

  const rcAppUserId = (body.rcAppUserId ?? '').trim();
  const referrerCode = normalizeReferrerCode(body.referrerCode ?? '');
  const platform = (body.platform ?? '').trim();

  if (rcAppUserId.length === 0) {
    return json({ok: false, error: 'Could not identify your account. Please try again.'}, 400);
  }
  if (referrerCode == null) {
    return json({ok: false, error: 'Enter a valid HZ referral code (e.g. HZABC123).'}, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const {data: referrerProfile} = await sb
    .from('referrer_profiles')
    .select('rc_user_id')
    .eq('referrer_code', referrerCode)
    .maybeSingle();

  if (referrerProfile?.rc_user_id == null) {
    return json({ok: false, error: 'Referral code not found. Check the code and try again.'}, 404);
  }

  const referrerRcId = referrerProfile.rc_user_id as string;

  if (referrerRcId === rcAppUserId) {
    return json({ok: false, error: 'You cannot use your own referral code.'}, 409);
  }

  if (await refereeAlreadyRedeemed(sb, rcAppUserId)) {
    return json(
      {ok: false, error: 'This account has already redeemed a referral code.'},
      409,
    );
  }

  const priorCount = await countReferrerRedemptions(sb, referrerCode);
  const redemptionIndex = priorCount + 1;
  const referrerTier = referrerTierForIndex(redemptionIndex);
  const referrerRewardType = referrerRewardTypeForTier(referrerTier);

  const {error: redemptionErr} = await sb.from('referral_redemptions').insert({
    referrer_code: referrerCode,
    referee_rc_id: rcAppUserId,
    referrer_rc_id: referrerRcId,
    redemption_index: redemptionIndex,
    platform: platform.length > 0 ? platform : null,
  });

  if (redemptionErr != null) {
    if (redemptionErr.code === '23505') {
      return json(
        {ok: false, error: 'This account has already redeemed a referral code.'},
        409,
      );
    }
    console.error('[claim-referral] redemption insert failed:', redemptionErr.message);
    return json({ok: false, error: 'Could not record referral redemption.'}, 500);
  }

  const refereeReward = await allocateReferralReward(
    sb,
    'refer_referee',
    platform,
    rcAppUserId,
    'once',
    '1_month',
  );
  if (!refereeReward.ok) {
    return json({ok: false, error: refereeReward.error}, refereeReward.status ?? 500);
  }

  const referrerReward = await allocateReferralReward(
    sb,
    referrerRewardType,
    platform,
    referrerRcId,
    String(redemptionIndex),
    referrerTier,
  );
  if (!referrerReward.ok) {
    console.error('[claim-referral] referrer allocation failed after referee:', referrerReward.error);
    return json({ok: false, error: referrerReward.error}, referrerReward.status ?? 500);
  }

  void setRcCustomerAttributes(rcAppUserId, {
    $referrer_code: referrerCode,
  });

  void setRcCustomerAttributes(referrerRcId, {
    referral_count: String(redemptionIndex),
  });

  return json({
    ok: true,
    referrerCode,
    redemptionIndex,
    referee: {
      code: refereeReward.claim.code,
      store: refereeReward.claim.store,
      rewardTier: refereeReward.claim.rewardTier,
      redeemUrl: refereeReward.claim.redeemUrl,
    },
    referrer: {
      code: referrerReward.claim.code,
      store: referrerReward.claim.store,
      rewardTier: referrerReward.claim.rewardTier,
      redeemUrl: referrerReward.claim.redeemUrl,
      redemptionIndex,
    },
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
