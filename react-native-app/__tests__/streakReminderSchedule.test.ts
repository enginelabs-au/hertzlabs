import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const DENIED = 0;
const AUTHORIZED = 1;

const notifee = vi.hoisted(() => ({
  createChannel: vi.fn(async () => 'streak-reminders'),
  cancelTriggerNotifications: vi.fn(async () => undefined),
  createTriggerNotification: vi.fn(async () => 'id'),
  getNotificationSettings: vi.fn(async () => ({authorizationStatus: 1})),
  isChannelBlocked: vi.fn(async () => false),
}));

vi.mock('@notifee/react-native', () => ({
  default: notifee,
  AndroidImportance: {DEFAULT: 3},
  AuthorizationStatus: {DENIED: 0, AUTHORIZED: 1},
  TriggerType: {TIMESTAMP: 0},
}));

import {
  cancelDailyStreakReminders,
  countIgnoredStreakReminders,
  planDailyStreakReminderTimes,
  scheduleDailyStreakReminders,
  STREAK_DAILY_REMINDER_LIMIT,
} from '../src/notifications/streakNotifications';

/** Local time on a day of November 2026. */
const nov = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).getTime();

const REMINDER_IDS = ['streak-daily-reminder', 'streak-daily-reminder-2', 'streak-daily-reminder-3'];

describe('daily streak reminder plan', () => {
  it('starts this evening while today still needs its 2 minutes', () => {
    expect(planDailyStreakReminderTimes(nov(17, 9), false)).toEqual([
      nov(17, 20),
      nov(18, 20),
      nov(19, 20),
    ]);
  });

  it('starts tomorrow once this evening has passed', () => {
    expect(planDailyStreakReminderTimes(nov(17, 21), false)).toEqual([
      nov(18, 20),
      nov(19, 20),
      nov(20, 20),
    ]);
  });

  it('starts tomorrow when today already has its 2 minutes', () => {
    expect(planDailyStreakReminderTimes(nov(17, 9), true)).toEqual([
      nov(18, 20),
      nov(19, 20),
      nov(20, 20),
    ]);
  });

  it('never plans more than the limit', () => {
    expect(STREAK_DAILY_REMINDER_LIMIT).toBe(3);
    expect(planDailyStreakReminderTimes(nov(17, 9), false)).toHaveLength(3);
  });
});

describe('ignored streak reminders', () => {
  const armed = [nov(17, 20), nov(18, 20), nov(19, 20)];

  it('counts nothing before a reminder has been shown', () => {
    expect(countIgnoredStreakReminders(armed, nov(17, 12))).toBe(0);
    expect(countIgnoredStreakReminders([], nov(17, 12))).toBe(0);
  });

  it('does not count a reminder the user came back after', () => {
    expect(countIgnoredStreakReminders(armed, nov(17, 21))).toBe(0);
    expect(countIgnoredStreakReminders(armed, nov(18, 8))).toBe(0);
  });

  it('counts each reminder that was followed by another day away', () => {
    expect(countIgnoredStreakReminders(armed, nov(18, 20, 30))).toBe(1);
    expect(countIgnoredStreakReminders(armed, nov(19, 21))).toBe(2);
    expect(countIgnoredStreakReminders(armed, nov(20, 20))).toBe(3);
  });

  it('stops at the limit however long the user stays away', () => {
    expect(countIgnoredStreakReminders(armed, nov(30, 9))).toBe(STREAK_DAILY_REMINDER_LIMIT);
  });

  it('starts again from zero once the app is opened and the reminders are re-armed', () => {
    const reopenedAt = nov(24, 9);
    const rearmed = planDailyStreakReminderTimes(reopenedAt, false);
    expect(rearmed).toEqual([nov(24, 20), nov(25, 20), nov(26, 20)]);
    expect(countIgnoredStreakReminders(rearmed, reopenedAt)).toBe(0);
  });
});

describe('scheduling daily streak reminders', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(nov(17, 9));
    vi.clearAllMocks();
    notifee.getNotificationSettings.mockResolvedValue({authorizationStatus: AUTHORIZED});
    notifee.isChannelBlocked.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('arms three one-off reminders instead of an endless daily repeat', async () => {
    const fireTimesMs = await scheduleDailyStreakReminders(5, false);

    expect(fireTimesMs).toEqual([nov(17, 20), nov(18, 20), nov(19, 20)]);
    expect(notifee.createTriggerNotification.mock.calls).toEqual(
      fireTimesMs.map((timestamp, i) => [
        expect.objectContaining({id: REMINDER_IDS[i], data: {campaign: 'streak_daily'}}),
        {type: 0, timestamp},
      ]),
    );
  });

  it('replaces whatever was armed before, including the old repeating reminder', async () => {
    await scheduleDailyStreakReminders(5, true);

    expect(notifee.cancelTriggerNotifications).toHaveBeenCalledWith(REMINDER_IDS);
    expect(notifee.cancelTriggerNotifications.mock.invocationCallOrder[0]).toBeLessThan(
      notifee.createTriggerNotification.mock.invocationCallOrder[0],
    );
  });

  it('arms nothing without a streak', async () => {
    expect(await scheduleDailyStreakReminders(0, false)).toEqual([]);
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it('arms nothing, so counts nothing, while notifications are off in system settings', async () => {
    notifee.getNotificationSettings.mockResolvedValue({authorizationStatus: DENIED});

    expect(await scheduleDailyStreakReminders(5, false)).toEqual([]);
    expect(notifee.cancelTriggerNotifications).toHaveBeenCalledWith(REMINDER_IDS);
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it('arms nothing, so counts nothing, while the reminder channel is switched off', async () => {
    notifee.isChannelBlocked.mockResolvedValue(true);

    expect(await scheduleDailyStreakReminders(5, false)).toEqual([]);
    expect(notifee.isChannelBlocked).toHaveBeenCalledWith('streak-reminders');
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it('cancels every evening reminder', async () => {
    await cancelDailyStreakReminders();

    expect(notifee.cancelTriggerNotifications).toHaveBeenCalledWith(REMINDER_IDS);
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  });
});
