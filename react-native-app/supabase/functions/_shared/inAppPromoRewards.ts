import type {SupabaseClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {
  allocateOne,
  redeemUrlForCode,
  type StoreOfferRewardTier,
  type StoreOfferStore,
} from './allocateStoreOfferCode.ts';
import {storeForOutreachPlatform} from './outreachPlatform.ts';

export type InAppRewardType =
  | 'streak_7'
  | 'streak_30'
  | 'streak_bonus'
  | 'review'
  | 'anniversary'
  | 'wellness'
  | 'share_link'
  | 'lapsed_winback_30'
  | 'focus_challenge_30';

const REWARD_TIER: Record<InAppRewardType, StoreOfferRewardTier> = {
  streak_7: '1_month',
  streak_30: '1_month',
  streak_bonus: '1_month',
  review: '1_month',
  anniversary: '1_month',
  wellness: '1_month',
  share_link: '1_month',
  lapsed_winback_30: '1_month',
  focus_challenge_30: '1_month',
};

export function rewardTierForInApp(type: InAppRewardType): StoreOfferRewardTier {
  return REWARD_TIER[type];
}

export function isInAppRewardType(value: string): value is InAppRewardType {
  return value in REWARD_TIER;
}

export type ClaimedStoreCode = {
  code: string;
  store: StoreOfferStore;
  rewardTier: StoreOfferRewardTier;
  redeemUrl: string;
  poolId: string;
};

/** @deprecated v3 — install-link rewards retired; always returns 0. */
export async function pendingReferInstallClaims(
  _sb: SupabaseClient,
  _rcUserId: string,
): Promise<number> {
  return 0;
}

/** Idempotent read of an existing claim. */
export async function findExistingClaim(
  sb: SupabaseClient,
  rcUserId: string,
  rewardType: InAppRewardType,
  rewardKey: string,
): Promise<ClaimedStoreCode | null> {
  const {data} = await sb
    .from('promo_reward_claims')
    .select('code, store, reward_tier, store_offer_code_id')
    .eq('rc_user_id', rcUserId)
    .eq('reward_type', rewardType)
    .eq('reward_key', rewardKey)
    .maybeSingle();
  if (data == null) {
    return null;
  }
  const store = data.store as StoreOfferStore;
  return {
    code: data.code as string,
    store,
    rewardTier: data.reward_tier as StoreOfferRewardTier,
    redeemUrl: redeemUrlForCode(store, data.code as string),
    poolId: data.store_offer_code_id as string,
  };
}

export async function allocateInAppReward(
  sb: SupabaseClient,
  rewardType: InAppRewardType,
  platform: string,
  rcUserId: string,
  rewardKeyIn = '',
): Promise<{ok: true; claim: ClaimedStoreCode} | {ok: false; error: string; status?: number}> {
  let rewardKey = rewardKeyIn;
  const existing = await findExistingClaim(sb, rcUserId, rewardType, rewardKey);
  if (existing != null) {
    return {ok: true, claim: existing};
  }

  const store = storeForOutreachPlatform(platform);
  if (store == null) {
    return {ok: false, error: 'Could not determine your app store. Try again from your device.', status: 400};
  }

  const tier = rewardTierForInApp(rewardType);
  const submissionType = rewardType;
  const allocated = await allocateOne(sb, store, tier, submissionType, null, rcUserId);
  if (allocated == null) {
    return {
      ok: false,
      error: 'No offer codes available right now. Please contact support@enginelabs.com.au.',
      status: 503,
    };
  }

  const {error: insertErr} = await sb.from('promo_reward_claims').insert({
    rc_user_id: rcUserId,
    reward_type: rewardType,
    reward_key: rewardKey,
    store_offer_code_id: allocated.id,
    code: allocated.code,
    store: allocated.store,
    reward_tier: allocated.rewardTier,
  });

  if (insertErr != null) {
    if (insertErr.code === '23505') {
      const raced = await findExistingClaim(sb, rcUserId, rewardType, rewardKey);
      if (raced != null) {
        return {ok: true, claim: raced};
      }
    }
    console.error('[inAppPromoRewards] claim insert failed:', insertErr.message);
    return {ok: false, error: 'Could not record reward claim.', status: 500};
  }

  return {
    ok: true,
    claim: {
      code: allocated.code,
      store: allocated.store,
      rewardTier: allocated.rewardTier,
      redeemUrl: redeemUrlForCode(allocated.store, allocated.code),
      poolId: allocated.id,
    },
  };
}
