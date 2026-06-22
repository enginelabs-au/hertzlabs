import {SUPABASE_FUNCTION_HEADERS} from '../monetization/supabaseAnon';
import {getOutreachPlatform} from './outreachPlatform';
import {getRcAppUserId} from './getRcAppUserId';
import {supabaseFunctionUrl} from './supabaseFunctionsBase';

export type InAppRewardType =
  | 'streak_7'
  | 'streak_30'
  | 'streak_bonus'
  | 'review'
  | 'anniversary'
  | 'wellness'
  | 'share_link'
  | 'refer_install';

export type ClaimPromoRewardResult =
  | {
      ok: true;
      code: string;
      store: 'apple' | 'google';
      redeemUrl: string;
      pendingReferInstallClaims: number;
    }
  | {ok: false; error: string};

const ENDPOINT = supabaseFunctionUrl('claim-promo-reward');

export async function claimPromoReward(
  rewardType: InAppRewardType,
  rewardKey?: string,
): Promise<ClaimPromoRewardResult> {
  const rcAppUserId = await getRcAppUserId();
  if (rcAppUserId == null) {
    return {
      ok: false,
      error: 'Could not identify your account. Close the app, reopen, wait a few seconds, then try again.',
    };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: SUPABASE_FUNCTION_HEADERS,
      body: JSON.stringify({
        rcAppUserId,
        rewardType,
        platform: getOutreachPlatform(),
        rewardKey: rewardKey ?? '',
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      code?: string;
      store?: 'apple' | 'google';
      redeemUrl?: string;
      pendingReferInstallClaims?: number;
    };
    if (!res.ok || data.ok !== true || data.code == null) {
      return {ok: false, error: data.error ?? 'Could not claim reward.'};
    }
    return {
      ok: true,
      code: data.code,
      store: data.store ?? 'apple',
      redeemUrl: data.redeemUrl ?? '',
      pendingReferInstallClaims: data.pendingReferInstallClaims ?? 0,
    };
  } catch {
    return {ok: false, error: 'Could not reach server. Check your connection.'};
  }
}
