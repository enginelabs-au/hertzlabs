import {describe, expect, it} from 'vitest';
import {FORCED_V1_TEST_UNLOCK, isPremiumUnlocked} from '../src/monetization/isPremiumUnlocked';

describe('isPremiumUnlocked — single canonical feature gate (Plan 05 §2.1)', () => {
  it('always unlocks for premium entitlement', () => {
    expect(isPremiumUnlocked('premium')).toBe(true);
  });

  it("ties a free user's unlock state exactly to the dev override flag (both directions)", () => {
    // Real-function, real-flag contract:
    //  - dev (FORCED true):  free is unlocked.
    //  - release (FORCED false): free is locked.
    // This assertion holds in BOTH states, so it becomes a release tripwire the
    // moment FORCED_V1_TEST_UNLOCK is flipped to false before submission.
    expect(isPremiumUnlocked('free')).toBe(FORCED_V1_TEST_UNLOCK);
  });

  it('documents the current production state — gate is OFF, real entitlement required', () => {
    // Plan 05 §0: FORCED_V1_TEST_UNLOCK is false; features are properly gated.
    // A free-tier user must NOT see premium content.
    expect(FORCED_V1_TEST_UNLOCK).toBe(false);
    expect(isPremiumUnlocked('free')).toBe(false);
  });
});
