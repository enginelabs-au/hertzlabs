import type {SupabaseClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {
  allocateOne,
  redeemUrlForCode,
  type StoreOfferRewardTier,
  type StoreOfferStore,
} from './allocateStoreOfferCode.ts';
import {storeForOutreachPlatform} from './outreachPlatform.ts';

export type ReferralRewardType =
  | 'refer_referee'
  | 'refer_referrer_1mo'
  | 'refer_referrer_3mo'
  | 'refer_purchase_upgrade';

export type ReferralClaimedCode = {
  code: string;
  store: StoreOfferStore;
  rewardTier: StoreOfferRewardTier;
  redeemUrl: string;
  poolId: string;
};

export function normalizeReferrerCode(raw: string): string | null {
  const normalized = raw.trim().toUpperCase().replace(/-/g, '');
  if (!/^HZ[A-Z0-9]{4,12}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

/** Referrer tier: every 6th successful referral → 3_month; otherwise 1_month. */
export function referrerTierForIndex(redemptionIndex: number): StoreOfferRewardTier {
  return redemptionIndex % 6 === 0 ? '3_month' : '1_month';
}

export function referrerRewardTypeForTier(tier: StoreOfferRewardTier): ReferralRewardType {
  return tier === '3_month' ? 'refer_referrer_3mo' : 'refer_referrer_1mo';
}

export async function countReferrerRedemptions(
  sb: SupabaseClient,
  referrerCode: string,
): Promise<number> {
  const {count, error} = await sb
    .from('referral_redemptions')
    .select('*', {count: 'exact', head: true})
    .eq('referrer_code', referrerCode);
  if (error != null) {
    console.error('[referralRewards] count failed:', error.message);
    return 0;
  }
  return count ?? 0;
}

export async function refereeAlreadyRedeemed(
  sb: SupabaseClient,
  refereeRcId: string,
): Promise<boolean> {
  const {data} = await sb
    .from('referral_redemptions')
    .select('id')
    .eq('referee_rc_id', refereeRcId)
    .maybeSingle();
  return data != null;
}

async function findExistingReferralClaim(
  sb: SupabaseClient,
  rcUserId: string,
  rewardType: ReferralRewardType,
  rewardKey: string,
): Promise<ReferralClaimedCode | null> {
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

export async function allocateReferralReward(
  sb: SupabaseClient,
  rewardType: ReferralRewardType,
  platform: string,
  rcUserId: string,
  rewardKey: string,
  tier: StoreOfferRewardTier,
): Promise<{ok: true; claim: ReferralClaimedCode} | {ok: false; error: string; status?: number}> {
  const existing = await findExistingReferralClaim(sb, rcUserId, rewardType, rewardKey);
  if (existing != null) {
    return {ok: true, claim: existing};
  }

  const store = storeForOutreachPlatform(platform);
  if (store == null) {
    return {
      ok: false,
      error: 'Could not determine your app store. Try again from your device.',
      status: 400,
    };
  }

  const allocated = await allocateOne(sb, store, tier, rewardType, null, rcUserId);
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
      const raced = await findExistingReferralClaim(sb, rcUserId, rewardType, rewardKey);
      if (raced != null) {
        return {ok: true, claim: raced};
      }
    }
    console.error('[referralRewards] claim insert failed:', insertErr.message);
    return {ok: false, error: 'Could not record referral reward.', status: 500};
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

/** Product rank for upgrade detection — higher = paid tier upgrade. */
const PRODUCT_RANK: Record<string, number> = {
  hertzlabs_bb_monthly: 2,
  hertzlabs_bb_annual: 3,
  hertzlabs_lifetime_ultra: 4,
};

export function productRank(productId: string | null | undefined): number {
  if (productId == null) {
    return 0;
  }
  return PRODUCT_RANK[productId] ?? 1;
}

export function isUpgradePath(
  prevProductId: string | null | undefined,
  nextProductId: string | null | undefined,
): boolean {
  return productRank(nextProductId) > productRank(prevProductId);
}
