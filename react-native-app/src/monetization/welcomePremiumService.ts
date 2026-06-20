import Purchases from 'react-native-purchases';
import {PROMO_VALIDATE_URL, WELCOME_PREMIUM_URL} from '@env';
import {refreshRcEntitlements} from './promoCodeService';
import {WELCOME_PREMIUM_CAMPAIGN} from './welcomePremiumConstants';

export type WelcomePremiumResult =
  | {ok: true; message: string; expiresAtMs?: number; extendedExisting?: boolean}
  | {ok: false; error: string};

const WELCOME_ENDPOINT =
  WELCOME_PREMIUM_URL?.trim() ||
  (PROMO_VALIDATE_URL?.trim()
    ? PROMO_VALIDATE_URL.trim().replace('/validate-promo', '/grant-welcome-premium')
    : null);

/** Ensures RevenueCat has registered this device user before the server grant call. */
async function syncRcCustomer(): Promise<string | null> {
  try {
    await Purchases.getCustomerInfo();
    if (typeof Purchases.syncPurchases === 'function') {
      await Purchases.syncPurchases();
    }
    await Purchases.getCustomerInfo();
    await new Promise<void>(resolve => setTimeout(resolve, 400));
    const info = await Purchases.getCustomerInfo();
    return info.originalAppUserId;
  } catch {
    return null;
  }
}

/**
 * Grants a one-time 7-day Premium entitlement via RevenueCat promotional API.
 * Existing Premium subscribers receive +7 days on their current expiry.
 */
export async function activateWelcomePremium(): Promise<WelcomePremiumResult> {
  const rcUserId = await syncRcCustomer();
  if (rcUserId == null || rcUserId.length === 0) {
    return {ok: false, error: 'Purchases are not ready yet. Please try again in a moment.'};
  }

  if (WELCOME_ENDPOINT != null) {
    try {
      const res = await fetch(WELCOME_ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          rcAppUserId: rcUserId,
          campaign: WELCOME_PREMIUM_CAMPAIGN,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        expiresAtMs?: number;
        extendedExisting?: boolean;
        alreadyClaimed?: boolean;
      };
      if (!res.ok || data.ok !== true) {
        return {ok: false, error: data.error ?? 'Could not activate Premium.'};
      }
      await refreshRcEntitlements();
      return {
        ok: true,
        message: data.message ?? 'Premium activated for 7 days.',
        expiresAtMs: data.expiresAtMs,
        extendedExisting: data.extendedExisting,
      };
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
