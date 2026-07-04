/**
 * Hertz Labs — check-promo-rewards
 *
 * POST /functions/v1/check-promo-rewards
 * Body: { rcAppUserId: string }
 *
 * Returns latest review status for Make a Post, Practitioner, and Beta flows.
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {pendingReferInstallClaims} from '../_shared/inAppPromoRewards.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RewardStatus = 'none' | 'pending' | 'approved' | 'rejected';

type ReferrerRewardRow = {
  code: string;
  rewardTier: string;
  rewardType: string;
  rewardKey: string;
  redeemUrl: string;
};

async function pendingReferrerRewards(
  sb: ReturnType<typeof createClient>,
  rcUserId: string,
): Promise<ReferrerRewardRow[]> {
  const {data} = await sb
    .from('promo_reward_claims')
    .select('code, reward_tier, reward_type, reward_key, store')
    .eq('rc_user_id', rcUserId)
    .in('reward_type', ['refer_referrer_1mo', 'refer_referrer_3mo', 'refer_purchase_upgrade'])
    .order('created_at', {ascending: false})
    .limit(20);

  if (data == null) {
    return [];
  }

  return data.map(row => {
    const store = row.store as string;
    const code = row.code as string;
    const redeemUrl =
      store === 'google'
        ? `https://play.google.com/redeem?code=${encodeURIComponent(code)}`
        : `https://apps.apple.com/redeem?ctx=offercodes&id=6777604364&code=${encodeURIComponent(code)}`;
    return {
      code,
      rewardTier: row.reward_tier as string,
      rewardType: row.reward_type as string,
      rewardKey: row.reward_key as string,
      redeemUrl,
    };
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  if (req.method !== 'POST') return json({error: 'Method not allowed.'}, 405);

  let body: {rcAppUserId?: string};
  try {
    body = await req.json();
  } catch {
    return json({error: 'Invalid JSON body.'}, 400);
  }

  const rcAppUserId = (body.rcAppUserId ?? '').trim();
  if (rcAppUserId.length === 0) {
    return json({post: 'none', practitioner: 'none', beta: 'none'});
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const [postRows, practRows, betaRows, affiliateRows] = await Promise.all([
    sb
      .from('post_submissions')
      .select('status')
      .eq('rc_user_id', rcAppUserId)
      .order('created_at', {ascending: false})
      .limit(1),
    sb
      .from('practitioner_applications')
      .select('status')
      .eq('rc_user_id', rcAppUserId)
      .order('created_at', {ascending: false})
      .limit(1),
    sb
      .from('app_messages')
      .select('status')
      .eq('rc_user_id', rcAppUserId)
      .eq('category', 'promo_beta')
      .order('created_at', {ascending: false})
      .limit(1),
    sb
      .from('affiliate_applications')
      .select('status')
      .eq('rc_user_id', rcAppUserId)
      .order('created_at', {ascending: false})
      .limit(1),
  ]);

  const pendingReferrals = await pendingReferInstallClaims(sb, rcAppUserId);
  const referrerRewards = await pendingReferrerRewards(sb, rcAppUserId);

  return json({
    post: mapStatus(postRows.data?.[0]?.status as string | undefined),
    practitioner: mapStatus(practRows.data?.[0]?.status as string | undefined),
    beta: mapStatus(betaRows.data?.[0]?.status as string | undefined),
    affiliate: mapAffiliateStatus(affiliateRows.data?.[0]?.status as string | undefined),
    pendingReferInstallClaims: pendingReferrals,
    referrerRewards,
    focusChallenge: await focusChallengeStatus(sb, rcAppUserId),
  });
});

function mapStatus(raw: string | undefined): RewardStatus {
  if (raw === 'approved') return 'approved';
  if (raw === 'rejected') return 'rejected';
  if (raw === 'pending') return 'pending';
  return 'none';
}

function mapAffiliateStatus(raw: string | undefined): RewardStatus {
  return mapStatus(raw);
}

async function focusChallengeStatus(
  sb: ReturnType<typeof createClient>,
  rcUserId: string,
): Promise<Record<string, unknown>> {
  const {data} = await sb
    .from('focus_challenge_progress')
    .select('attempt_id, status, current_day, last_completed_date, reward_claimed_at')
    .eq('rc_user_id', rcUserId)
    .order('started_at', {ascending: false})
    .limit(1);
  const row = data?.[0];
  if (row == null) {
    return {status: 'idle'};
  }
  return {
    attemptId: row.attempt_id,
    status: row.status,
    currentDay: row.current_day,
    lastCompletedDate: row.last_completed_date,
    rewardClaimed: row.reward_claimed_at != null,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
