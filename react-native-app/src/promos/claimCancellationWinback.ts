import {SUPABASE_FUNCTION_HEADERS} from '../monetization/supabaseAnon';
import {getOutreachPlatform} from './outreachPlatform';
import {getRcAppUserId} from './getRcAppUserId';
import {supabaseFunctionUrl} from './supabaseFunctionsBase';

export type ClaimCancellationWinbackResult =
  | {
      ok: true;
      code: string;
      store: 'apple' | 'google';
      redeemUrl: string;
      rewardTier: '1_month' | '3_month';
      offerTier: 'trial_1_month' | 'paid_3_month';
      epochId: number;
    }
  | {ok: false; error: string; eligible?: boolean};

const ENDPOINT = supabaseFunctionUrl('claim-cancellation-winback');

export async function claimCancellationWinback(input: {
  isTrial: boolean;
  productId: string | null;
  forfeit?: boolean;
}): Promise<ClaimCancellationWinbackResult> {
  const rcAppUserId = await getRcAppUserId();
  if (rcAppUserId == null) {
    return {ok: false, error: 'Could not identify your account. Reopen the app and try again.'};
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: SUPABASE_FUNCTION_HEADERS,
      body: JSON.stringify({
        rcAppUserId,
        platform: getOutreachPlatform(),
        isTrial: input.isTrial,
        productId: input.productId ?? '',
        forfeit: input.forfeit === true,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      eligible?: boolean;
      code?: string;
      store?: 'apple' | 'google';
      redeemUrl?: string;
      rewardTier?: '1_month' | '3_month';
      offerTier?: 'trial_1_month' | 'paid_3_month';
      epochId?: number;
    };
    if (!res.ok || data.ok !== true) {
      return {ok: false, error: data.error ?? 'Could not load winback offer.', eligible: data.eligible};
    }
    if (input.forfeit) {
      return {
        ok: true,
        code: '',
        store: 'apple',
        redeemUrl: '',
        rewardTier: '1_month',
        offerTier: input.isTrial ? 'trial_1_month' : 'paid_3_month',
        epochId: data.epochId ?? 1,
      };
    }
    if (data.code == null) {
      return {ok: false, error: 'No winback code returned.'};
    }
    return {
      ok: true,
      code: data.code,
      store: data.store ?? 'apple',
      redeemUrl: data.redeemUrl ?? '',
      rewardTier: data.rewardTier ?? '1_month',
      offerTier: data.offerTier ?? (input.isTrial ? 'trial_1_month' : 'paid_3_month'),
      epochId: data.epochId ?? 1,
    };
  } catch {
    return {ok: false, error: 'Could not reach server. Check your connection.'};
  }
}

export async function submitCancellationFeedback(input: {
  isTrial: boolean;
  productId: string | null;
  epochId: number;
  feedback: string;
}): Promise<{ok: boolean; error?: string}> {
  const rcAppUserId = await getRcAppUserId();
  if (rcAppUserId == null) {
    return {ok: false, error: 'Could not identify your account.'};
  }
  try {
    const res = await fetch(supabaseFunctionUrl('cancellation-feedback'), {
      method: 'POST',
      headers: SUPABASE_FUNCTION_HEADERS,
      body: JSON.stringify({
        rcAppUserId,
        platform: getOutreachPlatform(),
        isTrial: input.isTrial,
        productId: input.productId ?? '',
        epochId: input.epochId,
        feedback: input.feedback,
      }),
    });
    const data = (await res.json()) as {ok?: boolean; error?: string};
    return data.ok === true ? {ok: true} : {ok: false, error: data.error ?? 'Could not send feedback.'};
  } catch {
    return {ok: false, error: 'Could not reach server.'};
  }
}
