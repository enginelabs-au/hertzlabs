import Purchases from 'react-native-purchases';
import {PROMO_VALIDATE_URL, WELLNESS_CHECKIN_URL} from '@env';
import appVersion from '../../app.version.json';
import {getOutreachPlatform} from '../promos/outreachPlatform';
import {SUPABASE_FUNCTION_HEADERS} from './supabaseAnon';

export type WellnessCheckinPayload = {
  mood: number;
  sleepQuality: number;
  focusLevel: number;
};

export type WellnessCheckinResult =
  | {ok: true; message: string; code: string | null; redeemUrl: string | null; expiresAtMs: number | null}
  | {ok: false; error: string; nextAvailableAt?: string};

const ENDPOINT =
  WELLNESS_CHECKIN_URL?.trim() ||
  (PROMO_VALIDATE_URL?.trim()
    ? PROMO_VALIDATE_URL.trim().replace('/validate-promo', '/submit-wellness-checkin')
    : null);

export async function submitWellnessCheckin(
  payload: WellnessCheckinPayload,
): Promise<WellnessCheckinResult> {
  if (ENDPOINT == null) {
    return {ok: false, error: 'Wellness check-in is not configured yet.'};
  }

  let rcUserId = '';
  try {
    const info = await Purchases.getCustomerInfo();
    rcUserId = info.originalAppUserId;
  } catch {
    return {ok: false, error: 'Could not identify your account. Please try again.'};
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: SUPABASE_FUNCTION_HEADERS,
      body: JSON.stringify({
        rcAppUserId: rcUserId,
        mood: payload.mood,
        sleepQuality: payload.sleepQuality,
        focusLevel: payload.focusLevel,
        platform: getOutreachPlatform(),
        appVersion: `${appVersion.versionName} (${appVersion.versionCode})`,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      message?: string;
      error?: string;
      code?: string;
      redeemUrl?: string;
      nextAvailableAt?: string;
      expiresAtMs?: number | null;
    };
    if (!res.ok || !data.ok) {
      const serverMsg =
        data.error ??
        (typeof data.message === 'string' ? data.message : undefined) ??
        (typeof data.code === 'string' ? data.code : undefined);
      return {
        ok: false,
        error: serverMsg ?? 'Could not submit check-in.',
        nextAvailableAt: data.nextAvailableAt,
      };
    }
    return {
      ok: true,
      message: data.message ?? 'Check-in saved.',
      code: data.code ?? null,
      redeemUrl: data.redeemUrl ?? null,
      expiresAtMs: data.expiresAtMs ?? null,
    };
  } catch {
    return {ok: false, error: 'Could not reach server. Check your connection.'};
  }
}
