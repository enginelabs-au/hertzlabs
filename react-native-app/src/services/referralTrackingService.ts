import {Platform} from 'react-native';
import Purchases from 'react-native-purchases';
import {SUPABASE_ANON_KEY} from '../monetization/supabaseAnon';

const TRACK_REFERRAL_URL =
  'https://mvawkzhwgtlwxwkssvyg.supabase.co/functions/v1/track-referral';

async function resolveRefereeId(): Promise<string> {
  try {
    return await Purchases.getAppUserID();
  } catch {
    return 'anonymous';
  }
}

/** Records an install attributed to a referrer code (once per device / RC user). */
export async function reportReferralInstall(referrerCode: string): Promise<boolean> {
  try {
    const res = await fetch(TRACK_REFERRAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        event: 'install',
        referrer_code: referrerCode,
        referee_id: await resolveRefereeId(),
        platform: Platform.OS,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
