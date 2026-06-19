import Purchases from 'react-native-purchases';
import {PROMO_VALIDATE_URL} from '@env';
import type {PromoEntitlement} from '../state/slices/promo';

export type PromoValidationResult =
  | {valid: true; entitlement: PromoEntitlement; label: string; description: string}
  | {valid: false; error: string};

/**
 * Validates a promo code and returns what it grants.
 *
 * BACKEND INTEGRATION POINT
 * ─────────────────────────
 * Replace the body of `validatePromoCode` with a real API call once the
 * Supabase edge function / Vercel serverless endpoint is deployed.
 *
 * Expected endpoint contract:
 *   POST /api/promo/validate
 *   Body:   { code: string, rcAppUserId: string, platform: 'ios' | 'android' }
 *   200:    { valid: true, entitlement: PromoEntitlement, label: string, description: string, expiresAt?: number }
 *   4xx:    { valid: false, error: string }
 *
 * The backend should:
 *   1. Verify the code exists, has not been used, and has not expired.
 *   2. Mark it as used (hashed, single-use).
 *   3. For extended_trial or lifetime: call the RevenueCat REST API
 *      `POST /v1/subscribers/{rc_app_user_id}/entitlements/{entitlement_id}/promotional`
 *      with the appropriate duration ('three_month' | 'lifetime').
 *   4. For discount_20 / discount_50: return an Apple offer code or Google Play
 *      promotional code that carries through to the native payment sheet.
 */

const PROMO_ENDPOINT = PROMO_VALIDATE_URL?.trim() || null;

export async function validatePromoCode(rawCode: string): Promise<PromoValidationResult> {
  const code = rawCode.toUpperCase().trim();
  if (code.length < 4) {
    return {valid: false, error: 'Code is too short.'};
  }

  // ── Real backend call ──────────────────────────────────────────────────────
  if (PROMO_ENDPOINT != null) {
    try {
      let rcUserId: string | null = null;
      try {
        const info = await Purchases.getCustomerInfo();
        rcUserId = info.originalAppUserId;
      } catch {
        // Non-fatal — proceed without RC user id
      }

      const res = await fetch(PROMO_ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({code, rcAppUserId: rcUserId}),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const err = (data as {error?: string}).error ?? 'Invalid or expired code.';
        return {valid: false, error: err};
      }
      return data as PromoValidationResult;
    } catch {
      return {valid: false, error: 'Could not reach validation server. Check your connection.'};
    }
  }

  // ── Development fallback — only available in __DEV__ builds ─────────────
  if (__DEV__) {
    const DEV_CODES: Record<string, {entitlement: PromoEntitlement; label: string; description: string}> = {
      'HZDEV-TRIAL': {
        entitlement: 'extended_trial',
        label: '3-Month Trial',
        description: 'Enjoy 3 months of Hertz Labs Premium free.',
      },
      'HZDEV-LIFE': {
        entitlement: 'lifetime',
        label: 'Lifetime Premium',
        description: 'Lifetime Hertz Labs Premium access at no charge.',
      },
      'HZDEV-20OFF': {
        entitlement: 'discount_20',
        label: '2 Months Free',
        description: '2 free months added to your Hertz Labs plan.',
      },
      'HZDEV-50OFF': {
        entitlement: 'discount_50',
        label: '6 Months Free',
        description: '6 free months added to your Hertz Labs plan.',
      },
    };
    const match = DEV_CODES[code];
    if (match != null) {
      return {valid: true, ...match};
    }
  }

  return {valid: false, error: 'Code not found or already used.'};
}

/**
 * After the backend has granted a RevenueCat entitlement, call this to
 * refresh the local customer info cache so the app reflects the new tier.
 */
export async function refreshRcEntitlements(): Promise<boolean> {
  try {
    await Purchases.invalidateCustomerInfoCache();
    await Purchases.getCustomerInfo();
    return true;
  } catch {
    return false;
  }
}
