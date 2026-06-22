import {SUPABASE_FUNCTION_HEADERS} from '../monetization/supabaseAnon';
import {getRcAppUserId} from './getRcAppUserId';
import {supabaseFunctionUrl} from './supabaseFunctionsBase';

const CHECK_REWARDS_URL = supabaseFunctionUrl('check-promo-rewards');

export type PromoRewardStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type PromoRewardSnapshot = {
  post: PromoRewardStatus;
  practitioner: PromoRewardStatus;
  beta: PromoRewardStatus;
  pendingReferInstallClaims: number;
};

export async function fetchPromoRewardStatus(): Promise<PromoRewardSnapshot | null> {
  const rcAppUserId = await getRcAppUserId();
  if (rcAppUserId == null) {
    return null;
  }
  try {
    const res = await fetch(CHECK_REWARDS_URL, {
      method: 'POST',
      headers: SUPABASE_FUNCTION_HEADERS,
      body: JSON.stringify({rcAppUserId}),
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as Partial<PromoRewardSnapshot>;
    return {
      post: data.post ?? 'none',
      practitioner: data.practitioner ?? 'none',
      beta: data.beta ?? 'none',
      pendingReferInstallClaims: data.pendingReferInstallClaims ?? 0,
    };
  } catch {
    return null;
  }
}
