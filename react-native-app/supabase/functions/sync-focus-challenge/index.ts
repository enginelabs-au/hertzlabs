/**
 * POST /functions/v1/sync-focus-challenge
 * Body: { rcAppUserId, attemptId?, action: 'start' | 'status' }
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

  let body: {rcAppUserId?: string; attemptId?: string; action?: string};
  try {
    body = await req.json();
  } catch {
    return json({ok: false, error: 'Invalid JSON.'}, 400);
  }

  const rcAppUserId = (body.rcAppUserId ?? '').trim();
  const attemptId = (body.attemptId ?? '').trim();
  const action = (body.action ?? 'status').trim();

  if (rcAppUserId.length === 0) {
    return json({ok: false, error: 'Missing account id.'}, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (action === 'start') {
    if (attemptId.length === 0) {
      return json({ok: false, error: 'Missing attempt id.'}, 400);
    }
    const {data: activeRows} = await sb
      .from('focus_challenge_progress')
      .select('attempt_id')
      .eq('rc_user_id', rcAppUserId)
      .eq('status', 'active');

    for (const row of activeRows ?? []) {
      if (row.attempt_id !== attemptId) {
        await sb
          .from('focus_challenge_progress')
          .update({status: 'failed'})
          .eq('rc_user_id', rcAppUserId)
          .eq('attempt_id', row.attempt_id as string);
      }
    }

    const {error} = await sb.from('focus_challenge_progress').upsert(
      {
        rc_user_id: rcAppUserId,
        attempt_id: attemptId,
        status: 'active',
        current_day: 1,
        last_completed_date: null,
        started_at: new Date().toISOString(),
      },
      {onConflict: 'rc_user_id,attempt_id', ignoreDuplicates: true},
    );
    if (error != null) {
      console.error('[sync-focus-challenge] start:', error.message);
      return json({ok: false, error: 'Could not register challenge start.'}, 500);
    }
    return json({ok: true, status: 'active', currentDay: 1, attemptId});
  }

  let row: Record<string, unknown> | null = null;
  if (attemptId.length > 0) {
    const {data, error} = await sb
      .from('focus_challenge_progress')
      .select(
        'attempt_id, status, current_day, last_completed_date, reward_claimed_at, started_at, completed_at',
      )
      .eq('rc_user_id', rcAppUserId)
      .eq('attempt_id', attemptId)
      .maybeSingle();
    if (error != null) {
      console.error('[sync-focus-challenge] status:', error.message);
      return json({ok: false, error: 'Could not load status.'}, 500);
    }
    row = data;
  } else {
    const {data, error} = await sb
      .from('focus_challenge_progress')
      .select(
        'attempt_id, status, current_day, last_completed_date, reward_claimed_at, started_at, completed_at',
      )
      .eq('rc_user_id', rcAppUserId)
      .order('started_at', {ascending: false})
      .limit(1);
    if (error != null) {
      console.error('[sync-focus-challenge] status:', error.message);
      return json({ok: false, error: 'Could not load status.'}, 500);
    }
    row = data?.[0] ?? null;
  }

  if (row == null) {
    return json({ok: true, status: 'idle'});
  }

  return json({
    ok: true,
    attemptId: row.attempt_id,
    status: row.status,
    currentDay: row.current_day,
    lastCompletedDate: row.last_completed_date,
    rewardClaimed: row.reward_claimed_at != null,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
