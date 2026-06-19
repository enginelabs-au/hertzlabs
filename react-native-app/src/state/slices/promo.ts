import type {StateCreator} from 'zustand';
import type {AppStore} from '../types';

export type PromoEntitlement = 'extended_trial' | 'lifetime' | 'discount_20' | 'discount_50';

export type PromoSlice = {
  /** Promo code last successfully redeemed */
  appliedPromoCode: string | null;
  /** What the code grants */
  appliedPromoEntitlement: PromoEntitlement | null;
  /** Unix ms when entitlement expires (null = permanent / lifetime) */
  appliedPromoExpiresAt: number | null;
  /** User's unique share/referral code — generated on first Promos screen visit */
  myReferralCode: string | null;
  /** Consecutive days the user has opened the app */
  streakDays: number;
  /** ISO date string 'YYYY-MM-DD' of last streak check-in */
  lastStreakDate: string | null;
  /** ISO date string 'YYYY-MM-DD' of very first app open (anniversary reward) */
  firstInstallDate: string | null;
  /** True once the user has opened the App Store rating dialog */
  reviewRewardClaimed: boolean;
  streakReward7Claimed: boolean;
  streakReward30Claimed: boolean;
  anniversaryRewardClaimed: boolean;
  wellnessCheckinCount: number;
  lastWellnessCheckinDate: string | null;

  applyPromo(code: string, entitlement: PromoEntitlement, expiresAt?: number | null): void;
  clearPromo(): void;
  generateMyReferralCode(): void;
  checkInStreak(): void;
  ensureFirstInstallDate(): void;
  markReviewRewardClaimed(): void;
  markStreakReward7Claimed(): void;
  markStreakReward30Claimed(): void;
  markAnniversaryRewardClaimed(): void;
  recordWellnessCheckin(): void;
};

export const createPromoSlice: StateCreator<AppStore, [], [], PromoSlice> = set => ({
  appliedPromoCode: null,
  appliedPromoEntitlement: null,
  appliedPromoExpiresAt: null,
  myReferralCode: null,
  streakDays: 0,
  lastStreakDate: null,
  firstInstallDate: null,
  reviewRewardClaimed: false,
  streakReward7Claimed: false,
  streakReward30Claimed: false,
  anniversaryRewardClaimed: false,
  wellnessCheckinCount: 0,
  lastWellnessCheckinDate: null,

  applyPromo(code, entitlement, expiresAt = null) {
    set({
      appliedPromoCode: code.toUpperCase().trim(),
      appliedPromoEntitlement: entitlement,
      appliedPromoExpiresAt: expiresAt ?? null,
    });
  },

  clearPromo() {
    set({appliedPromoCode: null, appliedPromoEntitlement: null, appliedPromoExpiresAt: null});
  },

  generateMyReferralCode() {
    set(s => {
      if (s.myReferralCode != null) {
        return {};
      }
      const chars = 'ABCDEFHJKMNPQRSTUVWXYZ23456789';
      let code = 'HZ-';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return {myReferralCode: code};
    });
  },

  checkInStreak() {
    const today = new Date().toISOString().slice(0, 10);
    set(s => {
      if (s.lastStreakDate === today) {
        return {};
      }
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const newStreak = s.lastStreakDate === yesterday ? s.streakDays + 1 : 1;
      return {streakDays: newStreak, lastStreakDate: today};
    });
  },

  ensureFirstInstallDate() {
    set(s => {
      if (s.firstInstallDate != null) {
        return {};
      }
      return {firstInstallDate: new Date().toISOString().slice(0, 10)};
    });
  },

  markReviewRewardClaimed() {
    set({reviewRewardClaimed: true});
  },
  markStreakReward7Claimed() {
    set({streakReward7Claimed: true});
  },
  markStreakReward30Claimed() {
    set({streakReward30Claimed: true});
  },
  markAnniversaryRewardClaimed() {
    set({anniversaryRewardClaimed: true});
  },
  recordWellnessCheckin() {
    const today = new Date().toISOString().slice(0, 10);
    set(s => {
      if (s.lastWellnessCheckinDate === today) {
        return {};
      }
      return {
        wellnessCheckinCount: s.wellnessCheckinCount + 1,
        lastWellnessCheckinDate: today,
      };
    });
  },
});

/** Returns how many full days since a given ISO 'YYYY-MM-DD' string. */
export function daysSince(isoDate: string): number {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  return Math.floor((now - then) / 86_400_000);
}
