/**
 * Local scheduled notifications for streak reminders (Feature 19).
 * Uses Notifee — requires native rebuild after install.
 */
import {Platform} from 'react-native';
import {localDateIso} from '../promos/streakEngagement';

const CHANNEL_ID = 'streak-reminders';
export const STREAK_DAILY_NOTIFICATION_ID = 'streak-daily-reminder';
export const STREAK_RESTORE_NOTIFICATION_ID = 'streak-restore-offer';

type NotifeeModule = typeof import('@notifee/react-native').default;
type NotifeeTypes = typeof import('@notifee/react-native');

let notifeeMod: NotifeeModule | null = null;
let notifeeTypes: NotifeeTypes | null = null;

async function loadNotifee(): Promise<{notifee: NotifeeModule; types: NotifeeTypes} | null> {
  if (notifeeMod != null && notifeeTypes != null) {
    return {notifee: notifeeMod, types: notifeeTypes};
  }
  try {
    const mod = await import('@notifee/react-native');
    notifeeMod = mod.default;
    notifeeTypes = mod;
    return {notifee: notifeeMod, types: notifeeTypes};
  } catch {
    if (__DEV__) {
      console.warn('[streakNotifications] Notifee not linked — rebuild native app.');
    }
    return null;
  }
}

export async function ensureStreakNotificationChannel(): Promise<void> {
  const loaded = await loadNotifee();
  if (loaded == null) {
    return;
  }
  const {notifee, types} = loaded;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Streak reminders',
    importance: types.AndroidImportance.DEFAULT,
  });
}

export async function requestStreakNotificationPermission(): Promise<boolean> {
  const loaded = await loadNotifee();
  if (loaded == null) {
    return false;
  }
  const settings = await loaded.notifee.requestPermission();
  return (
    settings.authorizationStatus === loaded.types.AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === loaded.types.AuthorizationStatus.PROVISIONAL
  );
}

/** Evening reminder if user has not yet qualified today (2 min playback). */
export async function scheduleDailyStreakReminder(streakDays: number, hour = 20, minute = 0): Promise<void> {
  const loaded = await loadNotifee();
  if (loaded == null || streakDays < 1) {
    return;
  }
  const {notifee, types} = loaded;
  await ensureStreakNotificationChannel();
  await notifee.cancelTriggerNotification(STREAK_DAILY_NOTIFICATION_ID);

  const triggerAt = nextLocalTime(hour, minute);
  await notifee.createTriggerNotification(
    {
      id: STREAK_DAILY_NOTIFICATION_ID,
      title: 'Keep your streak alive',
      body: `Play for 2 minutes today to continue your ${streakDays}-day streak.`,
      android: {channelId: CHANNEL_ID, pressAction: {id: 'default'}},
      data: {campaign: 'streak_daily'},
    },
    {
      type: types.TriggerType.TIMESTAMP,
      timestamp: triggerAt,
      repeatFrequency: types.RepeatFrequency.DAILY,
    },
  );
}

/** Next-morning restore offer after a missed qualifying day. */
export async function scheduleStreakRestoreNotification(peakStreak: number): Promise<void> {
  const loaded = await loadNotifee();
  if (loaded == null || peakStreak < 1) {
    return;
  }
  const {notifee, types} = loaded;
  await ensureStreakNotificationChannel();
  await notifee.cancelTriggerNotification(STREAK_RESTORE_NOTIFICATION_ID);

  const triggerAt = nextLocalTime(9, 0, 1);
  await notifee.createTriggerNotification(
    {
      id: STREAK_RESTORE_NOTIFICATION_ID,
      title: 'Restore your streak?',
      body: `You missed yesterday — tap to restore your ${peakStreak}-day streak.`,
      android: {channelId: CHANNEL_ID, pressAction: {id: 'default'}},
      data: {campaign: 'streak_restore'},
    },
    {
      type: types.TriggerType.TIMESTAMP,
      timestamp: triggerAt,
    },
  );
}

export async function cancelStreakNotifications(): Promise<void> {
  const loaded = await loadNotifee();
  if (loaded == null) {
    return;
  }
  await loaded.notifee.cancelTriggerNotification(STREAK_DAILY_NOTIFICATION_ID);
  await loaded.notifee.cancelTriggerNotification(STREAK_RESTORE_NOTIFICATION_ID);
}

export async function cancelDailyStreakReminder(): Promise<void> {
  const loaded = await loadNotifee();
  if (loaded == null) {
    return;
  }
  await loaded.notifee.cancelTriggerNotification(STREAK_DAILY_NOTIFICATION_ID);
}

function nextLocalTime(hour: number, minute: number, daysAhead = 0): number {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, minute, 0, 0);
  if (daysAhead === 0 && d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

export function todayIsoForNotifications(): string {
  return localDateIso();
}
