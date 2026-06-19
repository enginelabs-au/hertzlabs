import Purchases from 'react-native-purchases';
import {PROMO_VALIDATE_URL, WELCOME_PREMIUM_URL} from '@env';
import {refreshRcEntitlements} from './promoCodeService';

export type WelcomePremiumResult =
  | {ok: true; message: string}
  | {ok: false; error: string};

const WELCOME_ENDPOINT =
  WELCOME_PREMIUM_URL?.trim() ||
  (PROMO_VALIDATE_URL?.trim()
    ? PROMO_VALIDATE_URL.trim().replace('/validate-promo', '/grant-welcome-premium')
    : null);

/**
 * Grants a one-time 7-day Premium entitlement via RevenueCat promotional API.
 * Requires the grant-welcome-premium Supabase edge function to be deployed.
 */
export async function activateWelcomePremium(): Promise<WelcomePremiumResult> {
  let rcUserId: string | null = null;
  try {
    const info = await Purchases.getCustomerInfo();
    rcUserId = info.originalAppUserId;
  } catch {
    return {ok: false, error: 'Purchases are not ready yet. Please try again in a moment.'};
  }

  if (rcUserId == null || rcUserId.length === 0) {
    return {ok: false, error: 'Could not identify your account.'};
  }

  if (WELCOME_ENDPOINT != null) {
    try {
      const res = await fetch(WELCOME_ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rcAppUserId: rcUserId}),
      });
      const data = (await res.json()) as {ok?: boolean; error?: string; message?: string};
      if (!res.ok || data.ok !== true) {
        return {ok: false, error: data.error ?? 'Could not activate Premium.'};
      }
      await refreshRcEntitlements();
      return {ok: true, message: data.message ?? 'Premium activated for 7 days.'};
    } catch {
      return {ok: false, error: 'Could not reach the activation server. Check your connection.'};
    }
  }

  if (__DEV__) {
    await refreshRcEntitlements();
    return {
      ok: true,
      message: 'Dev mode: welcome Premium recorded locally (deploy grant-welcome-premium for real RC grant).',
    };
  }

  return {
    ok: false,
    error: 'Welcome Premium is not configured yet. Set WELCOME_PREMIUM_URL in the app environment.',
  };
}
