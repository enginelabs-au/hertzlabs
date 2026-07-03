/**
 * POST /functions/v1/cancellation-feedback
 * Body: { rcAppUserId, platform, isTrial, productId, epochId, feedback? }
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ok: false, error: 'Invalid JSON body.'}, 400);
  }

  const rcAppUserId = String(body.rcAppUserId ?? '').trim();
  if (rcAppUserId.length === 0) {
    return json({ok: false, error: 'Missing account id.'}, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const feedback = String(body.feedback ?? '').slice(0, 4000);
  const platform = String(body.platform ?? '').trim() || null;
  const productId = String(body.productId ?? '').trim() || null;
  const epochId = body.epochId != null ? Number(body.epochId) : null;

  const message =
    feedback.length > 0
      ? feedback
      : '(skipped — user continued to winback without feedback)';

  const {error} = await sb.from('app_messages').insert({
    to_recipient: 'hello',
    subject: 'Hertz Labs — cancellation feedback',
    message: `[epoch ${epochId ?? '?'} · trial=${body.isTrial === true} · product=${productId ?? 'n/a'}]\n\n${message}`,
    category: 'cancellation_feedback',
    rc_user_id: rcAppUserId,
    platform,
    status: 'pending',
  });

  if (error != null) {
    console.error('[cancellation-feedback]', error.message);
    return json({ok: false, error: 'Could not save feedback.'}, 500);
  }

  return json({ok: true});
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
