import type {SupabaseClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {
  allocateOne,
  redeemUrlForCode,
  type StoreOfferRewardTier,
  type StoreOfferStore,
} from './allocateStoreOfferCode.ts';
import {storeForOutreachPlatform} from './outreachPlatform.ts';

export type CancellationOfferTier = 'trial_1_month' | 'paid_3_month';

export type CancellationWinbackRow = {
  code: string;
  store: StoreOfferStore;
  rewardTier: StoreOfferRewardTier;
  redeemUrl: string;
  epochId: number;
  offerTier: CancellationOfferTier;
  status: 'reserved' | 'redeemed' | 'forfeited';
};

export async function getOrCreateEpoch(
  sb: SupabaseClient,
  rcUserId: string,
  productId: string | null,
): Promise<number> {
  const {data: existing} = await sb
    .from('cancellation_epochs')
    .select('epoch_id, last_product_id')
    .eq('rc_user_id', rcUserId)
    .maybeSingle();

  if (existing == null) {
    await sb.from('cancellation_epochs').insert({
      rc_user_id: rcUserId,
      epoch_id: 1,
      last_product_id: productId,
    });
    return 1;
  }

  const lastProduct = (existing.last_product_id as string | null) ?? null;
  if (productId != null && lastProduct != null && productId !== lastProduct) {
    const nextEpoch = Number(existing.epoch_id ?? 1) + 1;
    await sb
      .from('cancellation_epochs')
      .update({epoch_id: nextEpoch, last_product_id: productId, updated_at: new Date().toISOString()})
      .eq('rc_user_id', rcUserId);
    return nextEpoch;
  }

  if (productId != null && lastProduct == null) {
    await sb
      .from('cancellation_epochs')
      .update({last_product_id: productId, updated_at: new Date().toISOString()})
      .eq('rc_user_id', rcUserId);
  }

  return Number(existing.epoch_id ?? 1);
}

export async function findExistingWinback(
  sb: SupabaseClient,
  rcUserId: string,
  epochId: number,
  offerTier: CancellationOfferTier,
): Promise<CancellationWinbackRow | null> {
  const {data} = await sb
    .from('cancellation_winback_allocations')
    .select('code, store, reward_tier, epoch_id, offer_tier, status')
    .eq('rc_user_id', rcUserId)
    .eq('epoch_id', epochId)
    .eq('offer_tier', offerTier)
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
    epochId: Number(data.epoch_id),
    offerTier: data.offer_tier as CancellationOfferTier,
    status: data.status as CancellationWinbackRow['status'],
  };
}

export async function reserveCancellationWinback(
  sb: SupabaseClient,
  rcUserId: string,
  platform: string,
  isTrial: boolean,
  productId: string | null,
): Promise<{ok: true; row: CancellationWinbackRow} | {ok: false; error: string; status?: number}> {
  const store = storeForOutreachPlatform(platform);
  if (store == null) {
    return {ok: false, error: 'Could not determine your app store.', status: 400};
  }

  const offerTier: CancellationOfferTier = isTrial ? 'trial_1_month' : 'paid_3_month';
  const rewardTier: StoreOfferRewardTier = isTrial ? '1_month' : '3_month';
  const epochId = await getOrCreateEpoch(sb, rcUserId, productId);

  const existing = await findExistingWinback(sb, rcUserId, epochId, offerTier);
  if (existing != null) {
    if (existing.status === 'redeemed' || existing.status === 'forfeited') {
      return {ok: false, error: 'Winback offer no longer available for this subscription period.', status: 403};
    }
    return {ok: true, row: existing};
  }

  const allocated = await allocateOne(
    sb,
    store,
    rewardTier,
    `cancellation_winback_${offerTier}`,
    null,
    rcUserId,
  );
  if (allocated == null) {
    return {ok: false, error: 'No offer codes available right now. Please contact support@enginelabs.com.au.', status: 503};
  }

  const {error: insertErr} = await sb.from('cancellation_winback_allocations').insert({
    rc_user_id: rcUserId,
    epoch_id: epochId,
    offer_tier: offerTier,
    store: allocated.store,
    store_offer_code_id: allocated.id,
    code: allocated.code,
    reward_tier: allocated.rewardTier,
    status: 'reserved',
    product_id_at_allocation: productId,
  });

  if (insertErr != null) {
    if (insertErr.code === '23505') {
      const raced = await findExistingWinback(sb, rcUserId, epochId, offerTier);
      if (raced != null) {
        return {ok: true, row: raced};
      }
    }
    console.error('[cancellationWinback] insert failed:', insertErr.message);
    return {ok: false, error: 'Could not reserve winback offer.', status: 500};
  }

  return {
    ok: true,
    row: {
      code: allocated.code,
      store: allocated.store,
      rewardTier: allocated.rewardTier,
      redeemUrl: redeemUrlForCode(allocated.store, allocated.code),
      epochId,
      offerTier,
      status: 'reserved',
    },
  };
}

export async function forfeitCancellationWinback(
  sb: SupabaseClient,
  rcUserId: string,
  epochId: number,
  offerTier: CancellationOfferTier,
): Promise<void> {
  await sb
    .from('cancellation_winback_allocations')
    .update({status: 'forfeited'})
    .eq('rc_user_id', rcUserId)
    .eq('epoch_id', epochId)
    .eq('offer_tier', offerTier)
    .eq('status', 'reserved');
}
