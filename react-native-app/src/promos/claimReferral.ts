import Purchases from 'react-native-purchases';
import {SUPABASE_FUNCTION_HEADERS} from '../monetization/supabaseAnon';
import {getOutreachPlatform} from './outreachPlatform';
import {getRcAppUserId} from './getRcAppUserId';
import {supabaseFunctionUrl} from './supabaseFunctionsBase';

export type ClaimReferralResult =
  | {
      ok: true;
      referrerCode: string;
      redemptionIndex: number;
      referee: {
        code: string;
        store: 'apple' | 'google';
        rewardTier: string;
        redeemUrl: string;
      };
      referrer: {
        code: string;
        store: 'apple' | 'google';
        rewardTier: string;
        redeemUrl: string;
        redemptionIndex: number;
      };
    }
  | {ok: false; error: string};

const ENDPOINT = supabaseFunctionUrl('claim-referral');

export async function claimReferral(referrerCode: string): Promise<ClaimReferralResult> {
  const rcAppUserId = await getRcAppUserId();
  if (rcAppUserId == null) {
    return {
      ok: false,
      error:
        'Could not identify your account. Close the app, reopen, wait a few seconds, then try again.',
    };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: SUPABASE_FUNCTION_HEADERS,
      body: JSON.stringify({
        rcAppUserId,
        referrerCode: referrerCode.trim(),
        platform: getOutreachPlatform(),
      }),
    });
    const data = (await res.json()) as ClaimReferralResult & {error?: string};
    if (!res.ok || data.ok !== true) {
      return {ok: false, error: data.error ?? 'Could not apply referral code.'};
    }

    try {
      await Purchases.setAttributes({
        $referrer_code: data.referrerCode,
      });
    } catch {
      // Non-fatal — server also sets attribute
    }

    return data;
  } catch {
    return {ok: false, error: 'Could not reach server. Check your connection.'};
  }
}
