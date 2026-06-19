/**
 * POST /functions/v1/track-referral
 * Body: { event: 'click' | 'install', referrer_code: string, referee_id?: string, platform?: string }
 *
 * GET  /functions/v1/track-referral?ref=HZ-XXXX  (logs click, returns 204)
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

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const ref = url.searchParams.get('ref')?.trim();
    if (ref == null || ref.length === 0) {
      return json({error: 'Missing ref parameter.'}, 400);
    }
    await sb.from('referral_clicks').insert({
      referrer_code: ref,
      user_agent: req.headers.get('user-agent'),
      platform: 'web',
    });
    return new Response(null, {status: 204, headers: CORS});
  }

  if (req.method !== 'POST') {
    return json({error: 'Method not allowed.'}, 405);
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({error: 'Invalid JSON body.'}, 400);
  }

  const event = body.event;
  const referrerCode = body.referrer_code?.trim();
  if (referrerCode == null || referrerCode.length === 0) {
    return json({error: 'referrer_code is required.'}, 400);
  }

  if (event === 'click') {
    await sb.from('referral_clicks').insert({
      referrer_code: referrerCode,
      user_agent: body.user_agent ?? req.headers.get('user-agent'),
      platform: body.platform ?? 'unknown',
    });
    return json({success: true});
  }

  if (event === 'install') {
    const refereeId = body.referee_id?.trim() ?? 'anonymous';
    await sb.from('referral_installs').upsert(
      {referrer_code: referrerCode, referee_id: refereeId},
      {onConflict: 'referrer_code,referee_id', ignoreDuplicates: true},
    );
    return json({success: true});
  }

  return json({error: 'Invalid event type.'}, 400);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
