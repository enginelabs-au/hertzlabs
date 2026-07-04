import {describe, expect, it} from 'vitest';
import {
  focusChallengeCanStartSession,
  focusChallengeCompletedToday,
} from '../src/focusChallenge/eligibility';
import {localDateIso} from '../src/promos/streakEngagement';

describe('focusChallenge eligibility', () => {
  it('detects completion today', () => {
    expect(focusChallengeCompletedToday(localDateIso())).toBe(true);
    expect(focusChallengeCompletedToday('2020-01-01')).toBe(false);
    expect(focusChallengeCompletedToday(null)).toBe(false);
  });

  it('blocks a second session on the same calendar day', () => {
    const gate = focusChallengeCanStartSession({
      status: 'active',
      lastCompletedDate: localDateIso(),
    });
    expect(gate.ok).toBe(false);
  });

  it('allows session when last completion was yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const gate = focusChallengeCanStartSession({
      status: 'active',
      lastCompletedDate: localDateIso(yesterday),
    });
    expect(gate.ok).toBe(true);
  });
});
