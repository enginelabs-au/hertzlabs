import {SUPABASE_ANON_KEY, SUPABASE_FUNCTION_HEADERS} from '../monetization/supabaseAnon';
import {getRcAppUserId} from './getRcAppUserId';
import {useHertzStore} from '../state/store';

const SUBMIT_FORM_URL =
  'https://mvawkzhwgtlwxwkssvyg.supabase.co/functions/v1/submit-form';

export async function submitPromoForm(
  payload: Record<string, string>,
): Promise<{ok: boolean; message: string}> {
  const rcUserId = await getRcAppUserId();
  const referralCode = useHertzStore.getState().myReferralCode;
  const body = {
    ...payload,
    rc_user_id: rcUserId ?? undefined,
    referral_code: referralCode ?? undefined,
  };
  try {
    const res = await fetch(SUBMIT_FORM_URL, {
      method: 'POST',
      headers: SUPABASE_FUNCTION_HEADERS,
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      success?: boolean;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      return {ok: false, message: data.error ?? 'Submission failed.'};
    }
    return {ok: true, message: data.message ?? 'Submitted!'};
  } catch {
    return {ok: false, message: 'Could not reach server. Check your connection.'};
  }
}

/** @deprecated use submitPromoForm */
export {SUBMIT_FORM_URL, SUPABASE_ANON_KEY};
