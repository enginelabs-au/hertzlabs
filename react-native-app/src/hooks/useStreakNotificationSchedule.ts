import {useEffect, useRef} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {useHertzStore} from '../state/store';
import {localDateIso} from '../promos/streakEngagement';
import {
  cancelDailyStreakReminder,
  cancelStreakNotifications,
  requestStreakNotificationPermission,
  scheduleDailyStreakReminder,
  scheduleStreakRestoreNotification,
} from '../notifications/streakNotifications';

const QUALIFYING_SEC = 120;

/**
 * Schedules local streak reminders when enabled; cancels when disabled or day qualified.
 */
export function useStreakNotificationSchedule(hydrated: boolean): void {
  const streakRemindersEnabled = useHertzStore(s => s.streakRemindersEnabled);
  const streakDays = useHertzStore(s => s.streakDays);
  const peakStreakDays = useHertzStore(s => s.peakStreakDays);
  const lastQualifyingDate = useHertzStore(s => s.lastQualifyingDate);
  const todayQualifyingPlaybackSec = useHertzStore(s => s.todayQualifyingPlaybackSec);
  const todayQualifyingBucketDate = useHertzStore(s => s.todayQualifyingBucketDate);

  const permissionRequested = useRef(false);

  useEffect(() => {
    if (!hydrated || !streakRemindersEnabled) {
      void cancelStreakNotifications();
      return;
    }

    if (!permissionRequested.current) {
      permissionRequested.current = true;
      void requestStreakNotificationPermission();
    }

    const today = localDateIso();
    const bucketToday =
      todayQualifyingBucketDate === today ? todayQualifyingPlaybackSec : 0;
    const qualifiedToday =
      lastQualifyingDate === today || bucketToday >= QUALIFYING_SEC;

    if (qualifiedToday) {
      void cancelDailyStreakReminder();
      return;
    }

    if (streakDays >= 1) {
      void scheduleDailyStreakReminder(streakDays);
    }
  }, [
    hydrated,
    streakRemindersEnabled,
    streakDays,
    lastQualifyingDate,
    todayQualifyingPlaybackSec,
    todayQualifyingBucketDate,
  ]);

  useEffect(() => {
    if (!hydrated || !streakRemindersEnabled) {
      return;
    }
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') {
        return;
      }
      const today = localDateIso();
      if (lastQualifyingDate != null && lastQualifyingDate < today && streakDays >= 1) {
        void scheduleStreakRestoreNotification(Math.max(streakDays, peakStreakDays));
      }
    });
    return () => sub.remove();
  }, [hydrated, streakRemindersEnabled, lastQualifyingDate, streakDays, peakStreakDays]);
}
