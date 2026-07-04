import {SUPABASE_FUNCTION_HEADERS} from '../monetization/supabaseAnon';
import {FOCUS_CHALLENGE_MIN_PLAY_SEC} from '../focusChallenge/dayTemplates';
import {localDateIso} from './streakEngagement';
import {getRcAppUserId} from './getRcAppUserId';
import {supabaseFunctionUrl} from './supabaseFunctionsBase';

export type FocusChallengeReflection = {
  focus: number;
  progression: number;
  breathing: number;
  reuse: number;
  note?: string;
};

export type FocusChallengeServerStatus = {
  status: 'idle' | 'active' | 'failed' | 'complete';
  attemptId?: string;
  currentDay?: number;
  lastCompletedDate?: string | null;
  rewardClaimed?: boolean;
};

export async function syncFocusChallengeStart(attemptId: string): Promise<boolean> {
  const rcAppUserId = await getRcAppUserId();
  if (rcAppUserId == null) {
    return false;
  }
  try {
    const res = await fetch(supabaseFunctionUrl('sync-focus-challenge'), {
      method: 'POST',
      headers: SUPABASE_FUNCTION_HEADERS,
      body: JSON.stringify({rcAppUserId, attemptId, action: 'start'}),
    });
    if (!res.ok) {
      return false;
    }
    const data = (await res.json()) as {ok?: boolean};
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function fetchFocusChallengeStatus(
  attemptId?: string | null,
): Promise<FocusChallengeServerStatus | null> {
  const rcAppUserId = await getRcAppUserId();
  if (rcAppUserId == null) {
    return null;
  }
  try {
    const res = await fetch(supabaseFunctionUrl('sync-focus-challenge'), {
      method: 'POST',
      headers: SUPABASE_FUNCTION_HEADERS,
      body: JSON.stringify({
        rcAppUserId,
        attemptId: attemptId ?? '',
        action: 'status',
      }),
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as FocusChallengeServerStatus & {ok?: boolean};
    return {
      status: data.status ?? 'idle',
      attemptId: data.attemptId,
      currentDay: data.currentDay,
      lastCompletedDate: data.lastCompletedDate,
      rewardClaimed: data.rewardClaimed,
    };
  } catch {
    return null;
  }
}

export type CompleteFocusChallengeDayResult =
  | {
      ok: true;
      status: 'active' | 'complete';
      currentDay: number;
      lastCompletedDate: string;
      rewardReady?: boolean;
      alreadyCompleted?: boolean;
    }
  | {ok: false; error: string; status?: 'failed' | 'active' | 'complete'};

export async function completeFocusChallengeDayRemote(input: {
  attemptId: string;
  dayIndex: number;
  durationPlayedSec: number;
  reflection: FocusChallengeReflection;
}): Promise<CompleteFocusChallengeDayResult> {
  const rcAppUserId = await getRcAppUserId();
  if (rcAppUserId == null) {
    return {ok: false, error: 'Could not identify your account.'};
  }
  if (input.durationPlayedSec < FOCUS_CHALLENGE_MIN_PLAY_SEC) {
    return {ok: false, error: 'Session too short to count this day.'};
  }
  try {
    const res = await fetch(supabaseFunctionUrl('complete-focus-challenge-day'), {
      method: 'POST',
      headers: SUPABASE_FUNCTION_HEADERS,
      body: JSON.stringify({
        rcAppUserId,
        attemptId: input.attemptId,
        dayIndex: input.dayIndex,
        durationPlayedSec: Math.floor(input.durationPlayedSec),
        completedDate: localDateIso(),
        reflection: input.reflection,
      }),
    });
    const data = (await res.json()) as CompleteFocusChallengeDayResult & {
      error?: string;
      message?: string;
      code?: string;
      status?: 'failed' | 'active' | 'complete';
      currentDay?: number;
      lastCompletedDate?: string;
      rewardReady?: boolean;
    };
    if (!res.ok || data.ok !== true) {
      const gatewayMsg =
        data.error ??
        (data.message && data.code ? `${data.code}: ${data.message}` : data.message);
      return {ok: false, error: gatewayMsg ?? 'Could not save day.', status: data.status};
    }
    return {
      ok: true,
      status: data.status ?? 'active',
      currentDay: data.currentDay ?? input.dayIndex,
      lastCompletedDate: data.lastCompletedDate ?? localDateIso(),
      rewardReady: data.rewardReady,
      alreadyCompleted: data.alreadyCompleted,
    };
  } catch {
    return {ok: false, error: 'Could not reach server.'};
  }
}
