import {useEffect, useRef, useState} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {usePostHog} from 'posthog-react-native';
import {useHertzStore} from '../state/store';
import {localDateIso} from '../promos/streakEngagement';
import {
  cancelDailyStreakReminders,
  cancelStreakNotifications,
  cancelStreakRestoreNotification,
  countIgnoredStreakReminders,
  requestStreakNotificationPermission,
  scheduleDailyStreakReminders,
  scheduleStreakRestoreNotification,
  STREAK_DAILY_REMINDER_LIMIT,
} from '../notifications/streakNotifications';

const QUALIFYING_SEC = 120;

/**
 * Schedules local streak reminders when enabled; cancels when disabled.
 *
 * The evening reminders are re-armed every time the app is opened or used, and only
 * STREAK_DAILY_REMINDER_LIMIT are armed at a time — so after that many go unanswered in a row
 * they stop until the app is opened again.
 */
export function useStreakNotificationSchedule(hydrated: boolean): void {
  const posthog = usePostHog();
  const streakRemindersEnabled = useHertzStore(s => s.streakRemindersEnabled);
  const streakDays = useHertzStore(s => s.streakDays);
  const peakStreakDays = useHertzStore(s => s.peakStreakDays);
  const lastQualifyingDate = useHertzStore(s => s.lastQualifyingDate);
  const todayQualifyingPlaybackSec = useHertzStore(s => s.todayQualifyingPlaybackSec);
  const todayQualifyingBucketDate = useHertzStore(s => s.todayQualifyingBucketDate);

  const permissionRequested = useRef(false);
  const [foregroundCount, setForegroundCount] = useState(0);

  const todayIso = localDateIso();
  const bucketToday = todayQualifyingBucketDate === todayIso ? todayQualifyingPlaybackSec : 0;
  // Today's date once it has its 2 minutes, else null — changes once per qualified day.
  const qualifiedDate =
    lastQualifyingDate === todayIso || bucketToday >= QUALIFYING_SEC ? todayIso : null;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        setForegroundCount(count => count + 1);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      void cancelStreakNotifications();
      return;
    }

    // Reaching here means the app is open or in use, which answers the reminders armed so far.
    const {streakReminderFireTimesMs, setStreakReminderFireTimes} = useHertzStore.getState();
    const ignoredCount = countIgnoredStreakReminders(streakReminderFireTimesMs, Date.now());
    if (streakReminderFireTimesMs.length > 0) {
      setStreakReminderFireTimes([]);
    }

    if (!streakRemindersEnabled) {
      void cancelStreakNotifications();
      return;
    }

    if (ignoredCount > 0) {
      posthog?.capture('streak reminders ignored', {
        ignored_count: ignoredCount,
        reminders_paused: ignoredCount >= STREAK_DAILY_REMINDER_LIMIT,
      });
    }

    if (!permissionRequested.current) {
      permissionRequested.current = true;
      void requestStreakNotificationPermission();
    }

    if (streakDays < 1) {
      void cancelDailyStreakReminders();
      return;
    }

    let superseded = false;
    scheduleDailyStreakReminders(streakDays, qualifiedDate != null)
      .then(fireTimesMs => {
        if (!superseded) {
          setStreakReminderFireTimes(fireTimesMs);
        }
      })
      .catch(() => {
        // Arming failed, so no reminder will be shown and there is nothing to count.
      });
    return () => {
      superseded = true;
    };
  }, [hydrated, streakRemindersEnabled, streakDays, qualifiedDate, foregroundCount, posthog]);

  useEffect(() => {
    if (!hydrated || !streakRemindersEnabled) {
      return;
    }
    // Playing today means "You missed yesterday" is no longer true for tomorrow morning.
    if (qualifiedDate != null) {
      void cancelStreakRestoreNotification();
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
  }, [
    hydrated,
    streakRemindersEnabled,
    lastQualifyingDate,
    streakDays,
    peakStreakDays,
    qualifiedDate,
  ]);
}
