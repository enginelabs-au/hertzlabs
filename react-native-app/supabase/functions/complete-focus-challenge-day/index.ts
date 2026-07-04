/**
 * POST /functions/v1/complete-focus-challenge-day
 * Body: {
 *   rcAppUserId, attemptId, dayIndex, durationPlayedSec,
 *   completedDate (YYYY-MM-DD), reflection?, platform?, appVersion?
 * }
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MIN_PLAY_SEC = 600;
const TOTAL_DAYS = 30;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ReflectionPayload = {
  focus?: number;
  progression?: number;
  breathing?: number;
  reuse?: number;
  note?: string;
};

type ProgressRow = {
  status: string;
  current_day: number;
  last_completed_date: string | null;
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
    return json({ok: false, error: 'Invalid JSON.'}, 400);
  }

  const rcAppUserId = String(body.rcAppUserId ?? '').trim();
  const attemptId = String(body.attemptId ?? '').trim();
  const dayIndex = parseDay(body.dayIndex);
  const durationPlayedSec = parseDuration(body.durationPlayedSec);
  const completedDate = String(body.completedDate ?? '').trim();
  const reflection = body.reflection as ReflectionPayload | undefined;

  if (rcAppUserId.length === 0 || attemptId.length === 0) {
    return json({ok: false, error: 'Missing account or attempt id.'}, 400);
  }
  if (dayIndex == null || !/^\d{4}-\d{2}-\d{2}$/.test(completedDate)) {
    return json({ok: false, error: 'Invalid day or date.'}, 400);
  }
  if (durationPlayedSec < MIN_PLAY_SEC) {
    return json(
      {
        ok: false,
        error: `Session too short — play at least ${Math.ceil(MIN_PLAY_SEC / 60)} minutes before submitting.`,
      },
      400,
    );
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const {data: fetchedRow, error: fetchErr} = await sb
    .from('focus_challenge_progress')
    .select('status, current_day, last_completed_date')
    .eq('rc_user_id', rcAppUserId)
    .eq('attempt_id', attemptId)
    .maybeSingle();

  if (fetchErr != null) {
    console.error('[complete-focus-challenge-day] fetch:', fetchErr.message);
    return json({ok: false, error: 'Could not load challenge.'}, 500);
  }

  let row: ProgressRow | null = fetchedRow as ProgressRow | null;

  if (row == null) {
    const {error: insertErr} = await sb.from('focus_challenge_progress').insert({
      rc_user_id: rcAppUserId,
      attempt_id: attemptId,
      status: 'active',
      current_day: dayIndex,
      last_completed_date: null,
    });
    if (insertErr != null) {
      console.error('[complete-focus-challenge-day] insert progress:', insertErr.message);
      return json({ok: false, error: 'Could not start challenge record.'}, 500);
    }
    row = {status: 'active', current_day: dayIndex, last_completed_date: null};
  } else if (row.status === 'failed' || row.status === 'complete') {
    return json({ok: false, error: 'Challenge is not active.'}, 409);
  } else if (Number(row.current_day) !== dayIndex) {
    const alreadyLogged = await dayLogExists(sb, rcAppUserId, attemptId, dayIndex);
    if (alreadyLogged && Number(row.current_day) === dayIndex + 1) {
      return json({
        ok: true,
        alreadyCompleted: true,
        status: row.status,
        currentDay: Number(row.current_day),
        lastCompletedDate: row.last_completed_date ?? completedDate,
      });
    }
    return json(
      {
        ok: false,
        error: `Day index mismatch — server expects day ${row.current_day}, app sent day ${dayIndex}. Pull to refresh Promos and try again.`,
      },
      409,
    );
  }

  const lastCompleted = row.last_completed_date;
  if (lastCompleted === completedDate) {
    const alreadyLogged = await dayLogExists(sb, rcAppUserId, attemptId, dayIndex);
    if (alreadyLogged) {
      return json({
        ok: true,
        alreadyCompleted: true,
        status: row.status,
        currentDay: Number(row.current_day),
        lastCompletedDate: completedDate,
      });
    }
    return json(
      {
        ok: false,
        error: 'You already completed a session today. Come back tomorrow for the next day.',
      },
      429,
    );
  }
  if (lastCompleted != null) {
    const yesterday = addDays(completedDate, -1);
    if (lastCompleted !== yesterday) {
      await sb
        .from('focus_challenge_progress')
        .update({status: 'failed'})
        .eq('rc_user_id', rcAppUserId)
        .eq('attempt_id', attemptId);
      return json({ok: false, error: 'Missed a day — challenge failed.', status: 'failed'}, 409);
    }
  }

  const {error: logErr} = await sb.from('focus_challenge_day_logs').upsert(
    {
      rc_user_id: rcAppUserId,
      attempt_id: attemptId,
      day_index: dayIndex,
      duration_played_sec: durationPlayedSec,
      reflection_json: reflection ?? null,
      completed_date: completedDate,
    },
    {onConflict: 'rc_user_id,attempt_id,day_index'},
  );
  if (logErr != null) {
    console.error('[complete-focus-challenge-day] log:', logErr.message);
    return json({ok: false, error: 'Could not save reflection.'}, 500);
  }

  const nextDay = dayIndex + 1;
  const isComplete = dayIndex >= TOTAL_DAYS;
  const patch = isComplete
    ? {
        status: 'complete',
        current_day: TOTAL_DAYS,
        last_completed_date: completedDate,
        completed_at: new Date().toISOString(),
      }
    : {
        status: 'active',
        current_day: nextDay,
        last_completed_date: completedDate,
      };

  const {error: updateErr} = await sb
    .from('focus_challenge_progress')
    .update(patch)
    .eq('rc_user_id', rcAppUserId)
    .eq('attempt_id', attemptId);

  if (updateErr != null) {
    console.error('[complete-focus-challenge-day] update:', updateErr.message);
    return json({ok: false, error: 'Could not update progress.'}, 500);
  }

  return json({
    ok: true,
    status: isComplete ? 'complete' : 'active',
    currentDay: isComplete ? TOTAL_DAYS : nextDay,
    lastCompletedDate: completedDate,
    rewardReady: isComplete,
  });
});

async function dayLogExists(
  sb: ReturnType<typeof createClient>,
  rcUserId: string,
  attemptId: string,
  dayIndex: number,
): Promise<boolean> {
  const {data, error} = await sb
    .from('focus_challenge_day_logs')
    .select('day_index')
    .eq('rc_user_id', rcUserId)
    .eq('attempt_id', attemptId)
    .eq('day_index', dayIndex)
    .maybeSingle();
  if (error != null) {
    console.error('[complete-focus-challenge-day] day log lookup:', error.message);
    return false;
  }
  return data != null;
}

function parseDay(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > TOTAL_DAYS) {
    return null;
  }
  return n;
}

function parseDuration(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function addDays(isoDate: string, delta: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
