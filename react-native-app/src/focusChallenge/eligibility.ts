import {localDateIso} from '../promos/streakEngagement';
import type {FocusChallengeStatus} from '../state/slices/focusChallenge';

export const FOCUS_CHALLENGE_NEXT_DAY_MESSAGE =
  'You already completed today\'s session. Come back tomorrow for the next day.';

export function focusChallengeCompletedToday(lastCompletedDate: string | null): boolean {
  return lastCompletedDate != null && lastCompletedDate === localDateIso();
}

export function focusChallengeCanStartSession(input: {
  status: FocusChallengeStatus;
  lastCompletedDate: string | null;
}): {ok: true} | {ok: false; message: string} {
  if (input.status !== 'active') {
    return {ok: false, message: 'Challenge is not active.'};
  }
  if (focusChallengeCompletedToday(input.lastCompletedDate)) {
    return {ok: false, message: FOCUS_CHALLENGE_NEXT_DAY_MESSAGE};
  }
  return {ok: true};
}
