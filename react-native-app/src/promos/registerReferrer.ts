import {SUPABASE_FUNCTION_HEADERS} from '../monetization/supabaseAnon';
import {getRcAppUserId} from './getRcAppUserId';
import {supabaseFunctionUrl} from './supabaseFunctionsBase';

const ENDPOINT = supabaseFunctionUrl('register-referrer');

/** Links HZ share ID to RC user so referral installs can grant store offer codes. */
export async function registerReferrer(referrerCode: string): Promise<void> {
  const rcAppUserId = await getRcAppUserId();
  if (rcAppUserId == null) {
    return;
  }
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: SUPABASE_FUNCTION_HEADERS,
      body: JSON.stringify({rcAppUserId, referrerCode}),
    });
  } catch {
    // Non-fatal — referral claims may fail until registered
  }
}
