/**
 * POST /functions/v1/register-referrer
 * Body: { rcAppUserId, referrerCode }
 *
 * Maps in-app HZ share ID → RevenueCat user for referral install rewards.
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

  let body: {rcAppUserId?: string; referrerCode?: string};
  try {
    body = await req.json();
  } catch {
    return json({ok: false, error: 'Invalid JSON body.'}, 400);
  }

  const rcAppUserId = (body.rcAppUserId ?? '').trim();
  const referrerCode = (body.referrerCode ?? '').trim().toUpperCase();

  if (rcAppUserId.length === 0 || referrerCode.length < 4) {
    return json({ok: false, error: 'Invalid referrer registration.'}, 400);
  }
  if (!/^HZ[A-Z0-9]{4,12}$/.test(referrerCode.replace(/-/g, ''))) {
    return json({ok: false, error: 'Invalid share link ID format.'}, 400);
  }

  const normalized = referrerCode.replace(/-/g, '');

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const {data: existingByCode} = await sb
    .from('referrer_profiles')
    .select('rc_user_id')
    .eq('referrer_code', normalized)
    .maybeSingle();

  if (existingByCode != null && existingByCode.rc_user_id !== rcAppUserId) {
    return json({ok: false, error: 'Share link ID already registered to another account.'}, 409);
  }

  const {error} = await sb.from('referrer_profiles').upsert(
    {referrer_code: normalized, rc_user_id: rcAppUserId},
    {onConflict: 'referrer_code'},
  );

  if (error != null) {
    console.error('[register-referrer] upsert failed:', error.message);
    return json({ok: false, error: 'Could not register share link ID.'}, 500);
  }

  return json({ok: true});
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
