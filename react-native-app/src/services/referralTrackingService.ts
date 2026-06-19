import {Platform} from 'react-native';
import Purchases from 'react-native-purchases';

const TRACK_REFERRAL_URL =
  'https://mvawkzhwgtlwxwkssvyg.supabase.co/functions/v1/track-referral';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12YXdremh3Z3Rsd3h3a3NzdnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NDE2OTcsImV4cCI6MjA5NzQxNzY5N30.mD0kFjNJFSlNEpOWHuO6tA0D1Oc_FHF2UqhDd2AMVOU';

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
