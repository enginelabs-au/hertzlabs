import type {SubscriptionTier} from '../state/types';

/**
 * DEVELOPMENT OVERRIDE.
 * When true, all users see Premium UI regardless of entitlement.
 * MUST be set to false before any App Store or Play Store submission.
 */
export const FORCED_V1_TEST_UNLOCK = true;

export function isPremiumUnlocked(tier: SubscriptionTier): boolean {
  return FORCED_V1_TEST_UNLOCK || tier === 'premium';
}
