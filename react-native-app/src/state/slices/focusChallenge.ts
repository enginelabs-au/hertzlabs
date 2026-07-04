import type {StateCreator} from 'zustand';
import type {AppStore} from '../types';
import {
  focusChallengePrescriptionForDay,
  FOCUS_CHALLENGE_MIN_PLAY_SEC,
  FOCUS_CHALLENGE_TOTAL_DAYS,
  focusChallengeRequiredSec,
} from '../../focusChallenge/dayTemplates';
import {localDateIso} from '../../promos/streakEngagement';
import {
  focusChallengeCanStartSession,
} from '../../focusChallenge/eligibility';

export type FocusChallengeStatus = 'idle' | 'active' | 'failed' | 'complete';

export type FocusChallengeSlice = {
  focusChallengeStatus: FocusChallengeStatus;
  focusChallengeAttemptId: string | null;
  focusChallengeCurrentDay: number;
  focusChallengeLastCompletedDate: string | null;
  focusChallengeStartedAtMs: number | null;
  focusChallengeRewardClaimed: boolean;
  focusChallengeSessionPlaybackSec: number;
  focusChallengeSessionRequiredSec: number;
  focusChallengeSessionActive: boolean;
  focusChallengeReflectionPending: boolean;
  startFocusChallenge(): void;
  restartFocusChallenge(): void;
  beginFocusChallengeSession(): void;
  addFocusChallengePlaybackSec(sec: number): void;
  markFocusChallengeReflectionPending(): void;
  finalizeFocusChallengeDayFromServer(patch: {
    status: FocusChallengeStatus;
    currentDay: number;
    lastCompletedDate: string;
  }): void;
  completeFocusChallengeDay(): void;
  failFocusChallenge(): void;
  markFocusChallengeRewardClaimed(): void;
  syncFocusChallengeMissedDay(): void;
  endFocusChallengeSessionEarly(): void;
  applyFocusChallengeServerPatch(patch: {
    status?: FocusChallengeStatus;
    attemptId?: string;
    currentDay?: number;
    lastCompletedDate?: string | null;
    rewardClaimed?: boolean;
  }): void;
};

function newAttemptId(): string {
  return `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const createFocusChallengeSlice: StateCreator<AppStore, [], [], FocusChallengeSlice> = (
  set,
  get,
) => ({
  focusChallengeStatus: 'idle',
  focusChallengeAttemptId: null,
  focusChallengeCurrentDay: 1,
  focusChallengeLastCompletedDate: null,
  focusChallengeStartedAtMs: null,
  focusChallengeRewardClaimed: false,
  focusChallengeSessionPlaybackSec: 0,
  focusChallengeSessionRequiredSec: 0,
  focusChallengeSessionActive: false,
  focusChallengeReflectionPending: false,

  startFocusChallenge: () => {
    const attemptId = newAttemptId();
    set({
      focusChallengeStatus: 'active',
      focusChallengeAttemptId: attemptId,
      focusChallengeCurrentDay: 1,
      focusChallengeLastCompletedDate: null,
      focusChallengeStartedAtMs: Date.now(),
      focusChallengeRewardClaimed: false,
      focusChallengeSessionPlaybackSec: 0,
      focusChallengeSessionRequiredSec: 0,
      focusChallengeSessionActive: false,
      focusChallengeReflectionPending: false,
    });
    void import('../../promos/focusChallengeSync').then(async m => {
      const ok = await m.syncFocusChallengeStart(attemptId);
      if (!ok) {
        console.warn('[focusChallenge] syncFocusChallengeStart failed for', attemptId);
      }
    });
  },

  restartFocusChallenge: () => {
    get().startFocusChallenge();
  },

  beginFocusChallengeSession: () => {
    const {focusChallengeStatus, focusChallengeCurrentDay, focusChallengeLastCompletedDate} =
      get();
    const gate = focusChallengeCanStartSession({
      status: focusChallengeStatus,
      lastCompletedDate: focusChallengeLastCompletedDate,
    });
    if (!gate.ok) {
      console.warn('[focusChallenge] beginFocusChallengeSession blocked:', gate.message);
      return;
    }
    const rx = focusChallengePrescriptionForDay(focusChallengeCurrentDay);
    get().setParam('beatHz', rx.beatHz);
    get().setEngineType(rx.engineMode);
    get().setBreathPatternId(rx.breathPatternId);
    get().setBreathPacerEnabled(true);
    get().setAsmrEnabled(true);
    get().setAsmrStemMix('rain', rx.asmrRain);
    get().setAsmrStemMix('room', rx.asmrRoom);
    get().setAsmrStemMix('brush', 0);
    get().setAsmrStemMix('tap', 0);
    set({
      focusChallengeSessionPlaybackSec: 0,
      focusChallengeSessionRequiredSec: focusChallengeRequiredSec(rx.durationMin),
      focusChallengeSessionActive: true,
      focusChallengeReflectionPending: false,
    });
  },

  addFocusChallengePlaybackSec: sec => {
    const {
      focusChallengeSessionActive,
      focusChallengeSessionPlaybackSec,
      focusChallengeSessionRequiredSec,
    } = get();
    if (!focusChallengeSessionActive) {
      return;
    }
    const next = focusChallengeSessionPlaybackSec + sec;
    set({focusChallengeSessionPlaybackSec: next});
    if (next >= focusChallengeSessionRequiredSec) {
      get().markFocusChallengeReflectionPending();
    }
  },

  markFocusChallengeReflectionPending: () => {
    set({focusChallengeReflectionPending: true, focusChallengeSessionActive: false});
  },

  endFocusChallengeSessionEarly: () => {
    const {focusChallengeSessionActive, focusChallengeSessionPlaybackSec} = get();
    if (!focusChallengeSessionActive) {
      return;
    }
    if (focusChallengeSessionPlaybackSec >= FOCUS_CHALLENGE_MIN_PLAY_SEC) {
      get().markFocusChallengeReflectionPending();
    }
  },

  applyFocusChallengeServerPatch: patch => {
    set(s => {
      const localActive =
        s.focusChallengeStatus === 'active' &&
        s.focusChallengeAttemptId != null &&
        patch.attemptId != null &&
        patch.attemptId !== s.focusChallengeAttemptId;
      return {
        focusChallengeStatus: patch.status ?? s.focusChallengeStatus,
        focusChallengeAttemptId: localActive
          ? s.focusChallengeAttemptId
          : (patch.attemptId ?? s.focusChallengeAttemptId),
        focusChallengeCurrentDay: patch.currentDay ?? s.focusChallengeCurrentDay,
        focusChallengeLastCompletedDate:
          patch.lastCompletedDate !== undefined
            ? patch.lastCompletedDate
            : s.focusChallengeLastCompletedDate,
        focusChallengeRewardClaimed:
          patch.rewardClaimed != null ? patch.rewardClaimed : s.focusChallengeRewardClaimed,
      };
    });
  },

  finalizeFocusChallengeDayFromServer: patch => {
    set({
      focusChallengeStatus: patch.status,
      focusChallengeCurrentDay: patch.currentDay,
      focusChallengeLastCompletedDate: patch.lastCompletedDate,
      focusChallengeSessionActive: false,
      focusChallengeReflectionPending: false,
      focusChallengeSessionPlaybackSec: 0,
    });
  },

  completeFocusChallengeDay: () => {
    const {
      focusChallengeStatus,
      focusChallengeCurrentDay,
      focusChallengeLastCompletedDate,
    } = get();
    if (focusChallengeStatus !== 'active') {
      return;
    }
    const today = localDateIso();
    if (focusChallengeLastCompletedDate === today) {
      return;
    }
    if (focusChallengeLastCompletedDate != null) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yIso = yesterday.toISOString().slice(0, 10);
      if (focusChallengeLastCompletedDate !== yIso) {
        get().failFocusChallenge();
        return;
      }
    }
    const nextDay = focusChallengeCurrentDay + 1;
    if (nextDay > FOCUS_CHALLENGE_TOTAL_DAYS) {
      set({
        focusChallengeStatus: 'complete',
        focusChallengeCurrentDay: FOCUS_CHALLENGE_TOTAL_DAYS,
        focusChallengeLastCompletedDate: today,
        focusChallengeSessionActive: false,
        focusChallengeReflectionPending: false,
        focusChallengeSessionPlaybackSec: 0,
      });
      return;
    }
    set({
      focusChallengeCurrentDay: nextDay,
      focusChallengeLastCompletedDate: today,
      focusChallengeSessionActive: false,
      focusChallengeReflectionPending: false,
      focusChallengeSessionPlaybackSec: 0,
    });
  },

  failFocusChallenge: () => {
    set({
      focusChallengeStatus: 'failed',
      focusChallengeSessionActive: false,
      focusChallengeReflectionPending: false,
      focusChallengeSessionPlaybackSec: 0,
    });
  },

  markFocusChallengeRewardClaimed: () => {
    set({focusChallengeRewardClaimed: true});
  },

  syncFocusChallengeMissedDay: () => {
    const {focusChallengeStatus, focusChallengeLastCompletedDate} = get();
    if (focusChallengeStatus !== 'active' || focusChallengeLastCompletedDate == null) {
      return;
    }
    const today = localDateIso();
    if (focusChallengeLastCompletedDate === today) {
      return;
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yIso = yesterday.toISOString().slice(0, 10);
    if (focusChallengeLastCompletedDate === yIso) {
      return;
    }
    const last = new Date(`${focusChallengeLastCompletedDate}T12:00:00`);
    const now = new Date(`${today}T12:00:00`);
    const diffDays = Math.round((now.getTime() - last.getTime()) / 86_400_000);
    if (diffDays === 2 && get().consumeStreakShield()) {
      return;
    }
    if (diffDays > 1) {
      get().failFocusChallenge();
    }
  },
});
