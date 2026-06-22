/**
 * Hertz Labs — submit-wellness-checkin edge function
 *
 * POST /functions/v1/submit-wellness-checkin
 * Body: { rcAppUserId, mood, sleepQuality, focusLevel, platform?, appVersion? }
 *
 * Stores wellness responses. Premium is not granted server-side — use store promo codes for rewards.
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {allocateInAppReward} from '../_shared/inAppPromoRewards.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: CORS});
  }

  if (req.method !== 'POST') {
    return json({ok: false, error: 'Method not allowed.'}, 405);
  }

  let body: {
    rcAppUserId?: string;
    mood?: number;
    sleepQuality?: number;
    focusLevel?: number;
    platform?: string;
    appVersion?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ok: false, error: 'Invalid JSON body.'}, 400);
  }

  const rcAppUserId = (body.rcAppUserId ?? '').trim();
  if (rcAppUserId.length === 0) {
    return json({ok: false, error: 'Could not identify your account. Please try again.'}, 400);
  }

  const mood = parseScore(body.mood);
  const sleepQuality = parseScore(body.sleepQuality);
  const focusLevel = parseScore(body.focusLevel);
  if (mood == null || sleepQuality == null || focusLevel == null) {
    return json({ok: false, error: 'Please rate mood, sleep, and focus from 1 to 10.'}, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const {data: lastRows} = await sb
    .from('wellness_checkins')
    .select('submitted_at')
    .eq('rc_user_id', rcAppUserId)
    .order('submitted_at', {ascending: false})
    .limit(1);

  const lastAt = lastRows?.[0]?.submitted_at as string | undefined;
  if (lastAt != null) {
    const elapsed = Date.now() - new Date(lastAt).getTime();
    if (elapsed < COOLDOWN_MS) {
      const nextMs = new Date(lastAt).getTime() + COOLDOWN_MS;
      return json(
        {
          ok: false,
          error: 'Wellness check-in is available once per week.',
          nextAvailableAt: new Date(nextMs).toISOString(),
        },
        429,
      );
    }
  }

  const {error: insertErr} = await sb.from('wellness_checkins').insert({
    rc_user_id: rcAppUserId,
    mood,
    sleep_quality: sleepQuality,
    focus_level: focusLevel,
    platform: (body.platform ?? '').trim() || null,
    app_version: (body.appVersion ?? '').trim() || null,
  });
  if (insertErr != null) {
    console.error('[submit-wellness-checkin] insert failed:', insertErr.message);
    return json({ok: false, error: 'Could not save check-in — please try again.'}, 500);
  }

  const platform = (body.platform ?? '').trim();
  const reward = await allocateInAppReward(sb, 'wellness', platform, rcAppUserId);

  if (!reward.ok) {
    return json({
      ok: true,
      message:
        'Thanks for checking in! We could not assign an offer code automatically — contact support@enginelabs.com.au if you need help.',
      code: null,
      redeemUrl: null,
    });
  }

  return json({
    ok: true,
    message: 'Thanks for checking in! Your App Store / Google Play offer code is ready — redeem it under Promos → Redeem.',
    code: reward.claim.code,
    store: reward.claim.store,
    redeemUrl: reward.claim.redeemUrl,
    expiresAtMs: null,
  });
});

function parseScore(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 10) {
    return null;
  }
  return Math.round(n);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
