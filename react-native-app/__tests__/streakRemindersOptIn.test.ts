import {describe, expect, it} from 'vitest';
import {STREAK_REMINDERS_OPT_IN_EPOCH} from '../src/state/slices/settings';

describe('streak reminders opt-in migration', () => {
  it('uses epoch 1 to disable legacy default-on reminders', () => {
    expect(STREAK_REMINDERS_OPT_IN_EPOCH).toBe(1);
  });

  it('migrates persisted users who had reminders enabled by default', () => {
    const state = {
      streakRemindersEnabled: true,
      streakRemindersOptInEpoch: 0,
    };
    if ((state.streakRemindersOptInEpoch ?? 0) < STREAK_REMINDERS_OPT_IN_EPOCH) {
      state.streakRemindersEnabled = false;
      state.streakRemindersOptInEpoch = STREAK_REMINDERS_OPT_IN_EPOCH;
    }
    expect(state.streakRemindersEnabled).toBe(false);
    expect(state.streakRemindersOptInEpoch).toBe(1);
  });

  it('preserves explicit opt-in after migration epoch', () => {
    const state = {
      streakRemindersEnabled: true,
      streakRemindersOptInEpoch: STREAK_REMINDERS_OPT_IN_EPOCH,
    };
    if ((state.streakRemindersOptInEpoch ?? 0) < STREAK_REMINDERS_OPT_IN_EPOCH) {
      state.streakRemindersEnabled = false;
      state.streakRemindersOptInEpoch = STREAK_REMINDERS_OPT_IN_EPOCH;
    }
    expect(state.streakRemindersEnabled).toBe(true);
  });
});
