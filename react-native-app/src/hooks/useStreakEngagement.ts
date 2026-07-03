import {useEffect, useRef} from 'react';
import {useHertzStore} from '../state/store';
import {
  detectStreakBreak,
  LAPSED_30_WINBACK_COOLDOWN_MS,
  LAPSED_7_RESTORE_COOLDOWN_MS,
  localDateIso,
  STREAK_RESTORE_OFFER_TTL_MS,
} from '../promos/streakEngagement';
import {shieldsEarnedForStreak} from '../promos/streakGamification';

/**
 * Missed-day restore + lapsed-user winback (Feature 19).
 * Local notification scheduling is mirrored via cold-start checks when streakRemindersEnabled.
 */
export function useStreakEngagement(hydrated: boolean, promptsEnabled: boolean): void {
  const activeModal = useHertzStore(s => s.activeModal);
  const streakRemindersEnabled = useHertzStore(s => s.streakRemindersEnabled);
  const promotionalOffersEnabled = useHertzStore(s => s.promotionalOffersEnabled);

  const streakDays = useHertzStore(s => s.streakDays);
  const peakStreakDays = useHertzStore(s => s.peakStreakDays);
  const lastQualifyingDate = useHertzStore(s => s.lastQualifyingDate);
  const streakShieldsUsed = useHertzStore(s => s.streakShieldsUsed);
  const streakRestoreOfferedAtMs = useHertzStore(s => s.streakRestoreOfferedAtMs);
  const streakRestoreHardDeclined = useHertzStore(s => s.streakRestoreHardDeclined);
  const lapsed7RestoreAtMs = useHertzStore(s => s.lapsed7RestoreAtMs);
  const lapsed30WinbackAtMs = useHertzStore(s => s.lapsed30WinbackAtMs);

  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const markStreakRestoreOffered = useHertzStore(s => s.markStreakRestoreOffered);
  const consumeStreakShield = useHertzStore(s => s.consumeStreakShield);
  const acceptStreakRestore = useHertzStore(s => s.acceptStreakRestore);
  const declineStreakRestore = useHertzStore(s => s.declineStreakRestore);
  const markLapsed7RestoreUsed = useHertzStore(s => s.markLapsed7RestoreUsed);
  const markLapsed30WinbackUsed = useHertzStore(s => s.markLapsed30WinbackUsed);
  const beginNewStreakRun = useHertzStore(s => s.beginNewStreakRun);

  const checked = useRef(false);

  useEffect(() => {
    if (!hydrated || !promptsEnabled || !streakRemindersEnabled || checked.current) {
      return;
    }
    if (activeModal != null) {
      return;
    }
    checked.current = true;

    const today = localDateIso();
    const breakKind = detectStreakBreak({streakDays, lastQualifyingDate, todayIso: today});
    if (breakKind == null) {
      return;
    }

    const now = Date.now();

    if (breakKind === 'lapsed_30' && promotionalOffersEnabled) {
      if (
        lapsed30WinbackAtMs == null ||
        now - lapsed30WinbackAtMs > LAPSED_30_WINBACK_COOLDOWN_MS
      ) {
        if (!streakRestoreHardDeclined) {
          setActiveModal('lapsedWinback30');
        }
      }
      return;
    }

    if (breakKind === 'lapsed_7') {
      if (lapsed7RestoreAtMs == null || now - lapsed7RestoreAtMs > LAPSED_7_RESTORE_COOLDOWN_MS) {
        if (!streakRestoreHardDeclined) {
          setActiveModal('lapsedWinback7');
        }
      }
      return;
    }

    if (streakRestoreOfferedAtMs != null && now - streakRestoreOfferedAtMs > STREAK_RESTORE_OFFER_TTL_MS) {
      declineStreakRestore();
      return;
    }

    if (streakRestoreOfferedAtMs != null) {
      return;
    }

    const earned = shieldsEarnedForStreak(Math.max(streakDays, peakStreakDays));
    const shieldsRemaining = Math.max(0, earned - streakShieldsUsed);
    if (shieldsRemaining > 0 && consumeStreakShield()) {
      beginNewStreakRun();
      return;
    }

    markStreakRestoreOffered();
    setActiveModal('streakRestore');
  }, [
    hydrated,
    promptsEnabled,
    streakRemindersEnabled,
    promotionalOffersEnabled,
    activeModal,
    streakDays,
    peakStreakDays,
    lastQualifyingDate,
    streakShieldsUsed,
    streakRestoreOfferedAtMs,
    streakRestoreHardDeclined,
    lapsed7RestoreAtMs,
    lapsed30WinbackAtMs,
    setActiveModal,
    markStreakRestoreOffered,
    consumeStreakShield,
    declineStreakRestore,
    beginNewStreakRun,
  ]);
}

export function streakEngagementHandlers() {
  const state = useHertzStore.getState();
  return {
    onAcceptRestore: () => {
      state.acceptStreakRestore();
      state.beginNewStreakRun();
    },
    onDeclineRestore: () => state.declineStreakRestore(),
    onUseShield: () => {
      state.consumeStreakShield();
      state.beginNewStreakRun();
    },
    onLapsed7Restore: () => {
      state.acceptStreakRestore();
      state.markLapsed7RestoreUsed();
      state.beginNewStreakRun();
    },
    onLapsed7Decline: () => state.declineStreakRestore(),
    onLapsed30Restore: () => {
      state.acceptStreakRestore();
      state.markLapsed30WinbackUsed();
      state.beginNewStreakRun();
    },
    onLapsed30Decline: () => state.declineStreakRestore(),
    shieldsRemaining: Math.max(
      0,
      shieldsEarnedForStreak(Math.max(state.streakDays, state.peakStreakDays)) -
        state.streakShieldsUsed,
    ),
  };
}
