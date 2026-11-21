/**
 * Local scheduled notifications for streak reminders (Feature 19).
 * Uses Notifee — requires native rebuild after install.
 */
import {Platform} from 'react-native';
import {localDateIso} from '../promos/streakEngagement';

const CHANNEL_ID = 'streak-reminders';
export const STREAK_DAILY_NOTIFICATION_ID = 'streak-daily-reminder';
export const STREAK_RESTORE_NOTIFICATION_ID = 'streak-restore-offer';

/**
 * One id per evening reminder. The first is the id older builds scheduled with an endless daily
 * repeat, so arming or cancelling these also removes that repeat.
 */
const DAILY_REMINDER_IDS = [
  STREAK_DAILY_NOTIFICATION_ID,
  `${STREAK_DAILY_NOTIFICATION_ID}-2`,
  `${STREAK_DAILY_NOTIFICATION_ID}-3`,
];
/** Evening reminders sent in a row before they pause until the app is next opened or used. */
export const STREAK_DAILY_REMINDER_LIMIT = DAILY_REMINDER_IDS.length;

const DAY_MS = 86_400_000;

let lastChange: Promise<unknown> = Promise.resolve();

/**
 * Applies schedule and cancel requests one at a time, so the latest request decides what stays
 * armed.
 */
function inOrder<T>(change: () => Promise<T>): Promise<T> {
  const run = lastChange.then(change);
  lastChange = run.catch(() => undefined);
  return run;
}

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

/**
 * When the next evening reminders are due: today at `hour:minute`, or from tomorrow if that time
 * has passed or today already has its 2 minutes of playback, then one per following day.
 */
export function planDailyStreakReminderTimes(
  nowMs: number,
  skipToday: boolean,
  hour = 20,
  minute = 0,
): number[] {
  const first = new Date(nowMs);
  first.setHours(hour, minute, 0, 0);
  if (skipToday || first.getTime() <= nowMs) {
    first.setDate(first.getDate() + 1);
  }
  return DAILY_REMINDER_IDS.map((_, i) => {
    const at = new Date(first);
    at.setDate(first.getDate() + i);
    return at.getTime();
  });
}

/**
 * How many of the armed reminders went unanswered. A reminder counts as ignored once a full day
 * passes after it without the app being opened — by then the next evening's reminder is due.
 */
export function countIgnoredStreakReminders(fireTimesMs: number[], nowMs: number): number {
  return fireTimesMs.filter(at => nowMs - at >= DAY_MS).length;
}

/** Whether the phone's settings stop streak reminders from being shown. */
async function remindersTurnedOffInSystemSettings(
  notifee: NotifeeModule,
  types: NotifeeTypes,
): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  return (
    settings.authorizationStatus === types.AuthorizationStatus.DENIED ||
    (await notifee.isChannelBlocked(CHANNEL_ID))
  );
}

/**
 * Arms the evening reminders for the next days without 2 minutes of playback and returns when
 * they will fire. Each fires once, so unless the app is opened or used again (which re-arms
 * them) no more are sent after STREAK_DAILY_REMINDER_LIMIT.
 *
 * Arms nothing, and returns no times, when the phone would not show them — a reminder that
 * never appears cannot be ignored.
 */
export function scheduleDailyStreakReminders(
  streakDays: number,
  skipToday: boolean,
  hour = 20,
  minute = 0,
): Promise<number[]> {
  return inOrder(async () => {
    const loaded = await loadNotifee();
    if (loaded == null || streakDays < 1) {
      return [];
    }
    const {notifee, types} = loaded;
    await ensureStreakNotificationChannel();
    await notifee.cancelTriggerNotifications(DAILY_REMINDER_IDS);
    if (await remindersTurnedOffInSystemSettings(notifee, types)) {
      return [];
    }

    const fireTimesMs = planDailyStreakReminderTimes(Date.now(), skipToday, hour, minute);
    for (let i = 0; i < fireTimesMs.length; i++) {
      await notifee.createTriggerNotification(
        {
          id: DAILY_REMINDER_IDS[i],
          title: 'Keep your streak alive',
          body: `Play for 2 minutes today to continue your ${streakDays}-day streak.`,
          android: {channelId: CHANNEL_ID, pressAction: {id: 'default'}},
          data: {campaign: 'streak_daily'},
        },
        {
          type: types.TriggerType.TIMESTAMP,
          timestamp: fireTimesMs[i],
        },
      );
    }
    return fireTimesMs;
  });
}

/**
 * Next-morning restore offer, armed while today has not yet had its 2 minutes of playback. It
 * tells the user they missed yesterday, so it must be withdrawn if today gets its 2 minutes.
 */
export function scheduleStreakRestoreNotification(peakStreak: number): Promise<void> {
  return inOrder(async () => {
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
  });
}

export function cancelStreakRestoreNotification(): Promise<void> {
  return inOrder(async () => {
    const loaded = await loadNotifee();
    if (loaded == null) {
      return;
    }
    await loaded.notifee.cancelTriggerNotification(STREAK_RESTORE_NOTIFICATION_ID);
  });
}

export function cancelStreakNotifications(): Promise<void> {
  return inOrder(async () => {
    const loaded = await loadNotifee();
    if (loaded == null) {
      return;
    }
    await loaded.notifee.cancelTriggerNotifications([
      ...DAILY_REMINDER_IDS,
      STREAK_RESTORE_NOTIFICATION_ID,
    ]);
  });
}

export function cancelDailyStreakReminders(): Promise<void> {
  return inOrder(async () => {
    const loaded = await loadNotifee();
    if (loaded == null) {
      return;
    }
    await loaded.notifee.cancelTriggerNotifications(DAILY_REMINDER_IDS);
  });
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
