/**
 * Hertz Labs — check-promo-rewards
 *
 * POST /functions/v1/check-promo-rewards
 * Body: { rcAppUserId: string }
 *
 * Returns latest review status for Make a Post, Practitioner, and Beta flows.
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RewardStatus = 'none' | 'pending' | 'approved' | 'rejected';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  if (req.method !== 'POST') return json({error: 'Method not allowed.'}, 405);

  let body: {rcAppUserId?: string};
  try {
    body = await req.json();
  } catch {
    return json({error: 'Invalid JSON body.'}, 400);
  }

  const rcAppUserId = (body.rcAppUserId ?? '').trim();
  if (rcAppUserId.length === 0) {
    return json({post: 'none', practitioner: 'none', beta: 'none'});
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const [postRows, practRows, betaRows] = await Promise.all([
    sb
      .from('post_submissions')
      .select('status')
      .eq('rc_user_id', rcAppUserId)
      .order('created_at', {ascending: false})
      .limit(1),
    sb
      .from('practitioner_applications')
      .select('status')
      .eq('rc_user_id', rcAppUserId)
      .order('created_at', {ascending: false})
      .limit(1),
    sb
      .from('app_messages')
      .select('status')
      .eq('rc_user_id', rcAppUserId)
      .eq('category', 'promo_beta')
      .order('created_at', {ascending: false})
      .limit(1),
  ]);

  return json({
    post: mapStatus(postRows.data?.[0]?.status as string | undefined),
    practitioner: mapStatus(practRows.data?.[0]?.status as string | undefined),
    beta: mapStatus(betaRows.data?.[0]?.status as string | undefined),
  });
});

function mapStatus(raw: string | undefined): RewardStatus {
  if (raw === 'approved') return 'approved';
  if (raw === 'rejected') return 'rejected';
  if (raw === 'pending') return 'pending';
  return 'none';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
