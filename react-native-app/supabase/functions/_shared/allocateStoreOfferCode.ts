import {createClient, type SupabaseClient} from 'https://esm.sh/@supabase/supabase-js@2';
import type {OutreachPromoType} from './outreachPromo.ts';
import {storeForOutreachPlatform} from './outreachPlatform.ts';

export type StoreOfferStore = 'apple' | 'google';
export type StoreOfferRewardTier = '1_month' | '3_month';

export type StoreOfferAllocation = {
  id: string;
  code: string;
  store: StoreOfferStore;
  rewardTier: StoreOfferRewardTier;
};

export type OutreachCodeBundle = {
  primary: StoreOfferAllocation | null;
  apple: StoreOfferAllocation | null;
  google: StoreOfferAllocation | null;
  appleRemaining: number;
  googleRemaining: number;
};

export function rewardTierForOutreach(type: OutreachPromoType): StoreOfferRewardTier {
  return type === 'practitioner' ? '3_month' : '1_month';
}

/** @deprecated use storeForOutreachPlatform */
export function storeForPlatform(platform: string): StoreOfferStore | null {
  return storeForOutreachPlatform(platform);
}

export function redeemUrlForCode(store: StoreOfferStore, code: string): string {
  const encoded = encodeURIComponent(code.trim());
  if (store === 'google') {
    return `https://play.google.com/redeem?code=${encoded}`;
  }
  return `https://apps.apple.com/redeem?ctx=offercodes&id=6777604364&code=${encoded}`;
}

export async function countAvailable(
  sb: SupabaseClient,
  store: StoreOfferStore,
  tier: StoreOfferRewardTier,
): Promise<number> {
  const {data, error} = await sb.rpc('count_available_store_offer_codes', {
    p_store: store,
    p_reward_tier: tier,
  });
  if (error != null) {
    console.error('[allocateStoreOfferCode] count failed:', error.message);
    return 0;
  }
  return Number(data ?? 0);
}

export async function allocateOne(
  sb: SupabaseClient,
  store: StoreOfferStore,
  tier: StoreOfferRewardTier,
  submissionType: string,
  submissionId: string | null,
  rcUserId: string | null,
): Promise<StoreOfferAllocation | null> {
  const {data, error} = await sb.rpc('allocate_store_offer_code', {
    p_store: store,
    p_reward_tier: tier,
    p_submission_type: submissionType,
    p_submission_id: submissionId,
    p_rc_user_id: rcUserId,
  });
  if (error != null) {
    console.error('[allocateStoreOfferCode] allocate failed:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row == null || typeof row !== 'object') {
    return null;
  }
  const r = row as {id?: string; code?: string; store?: string; reward_tier?: string};
  if (r.id == null || r.code == null || r.store == null || r.reward_tier == null) {
    return null;
  }
  return {
    id: r.id,
    code: r.code,
    store: r.store as StoreOfferStore,
    rewardTier: r.reward_tier as StoreOfferRewardTier,
  };
}

/** Reserve one code for the submitter's platform only (never both stores). */
export async function allocateOutreachCodes(
  sb: SupabaseClient,
  type: OutreachPromoType,
  platform: string,
  submissionId: string | null,
  rcUserId: string | null,
): Promise<OutreachCodeBundle> {
  const tier = rewardTierForOutreach(type);
  const knownStore = storeForOutreachPlatform(platform);

  const [appleRemaining, googleRemaining] = await Promise.all([
    countAvailable(sb, 'apple', tier),
    countAvailable(sb, 'google', tier),
  ]);

  if (knownStore == null) {
    return {primary: null, apple: null, google: null, appleRemaining, googleRemaining};
  }

  const allocated = await allocateOne(sb, knownStore, tier, type, submissionId, rcUserId);

  return {
    primary: allocated,
    apple: knownStore === 'apple' ? allocated : null,
    google: knownStore === 'google' ? allocated : null,
    appleRemaining,
    googleRemaining,
  };
}

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, key);
}
