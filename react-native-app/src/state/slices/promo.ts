import type {StateCreator} from 'zustand';
import type {PremiumGiftReminderKind} from '../../monetization/premiumGiftReminders';
import {formatPromoCodeDisplay} from '../../monetization/promoCodeFormat';
import {WELCOME_PREMIUM_CAMPAIGN} from '../../monetization/welcomePremiumConstants';
import type {AppStore} from '../types';

export type PromoEntitlement =
  | 'one_month'
  | 'extended_trial'
  | 'lifetime'
  | 'discount_2mo'
  | 'discount_6mo';

/** Map legacy / edge-compat entitlement strings to canonical promo entitlements. */
export function normalizePromoEntitlement(
  value: string | null | undefined,
): PromoEntitlement | null {
  switch (value) {
    case 'one_month':
    case 'extended_trial':
    case 'lifetime':
    case 'discount_2mo':
    case 'discount_6mo':
      return value;
    case 'discount_20':
      return 'discount_2mo';
    case 'discount_50':
      return 'discount_6mo';
    default:
      return null;
  }
}

/** Increment to force-reset all local promo claim flags on next app launch. */
export const PROMO_CLAIM_RESET_EPOCH = 8;

/** @deprecated use PROMO_CLAIM_RESET_EPOCH */
export const OUTREACH_PROMO_RESET_EPOCH = PROMO_CLAIM_RESET_EPOCH;

export type PromoSlice = {
  /** Last promo code copied or awarded — pre-fills paywall redemption input. */
  clipboardPromoCode: string | null;
  /** Promo code last successfully redeemed */
  appliedPromoCode: string | null;
  /** What the code grants */
  appliedPromoEntitlement: PromoEntitlement | null;
  /** Unix ms when entitlement expires (null = permanent / lifetime) */
  appliedPromoExpiresAt: number | null;
  /** User's unique share/referral code — generated on first Promos screen visit */
  myReferralCode: string | null;
  /** Referrer code captured from an incoming deep link (install attribution) */
  pendingReferrerCode: string | null;
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
  /** Milestone day numbers (40, 50, 60…) already claimed for +3 day bonuses */
  streakBonusMilestonesClaimed: number[];
  anniversaryRewardClaimed: boolean;
  wellnessCheckinCount: number;
  lastWellnessCheckinDate: string | null;
  /** User submitted Make a Post — awaiting admin review (not a grant). */
  postSubmissionPending: boolean;
  postRewardGranted: boolean;
  practitionerSubmissionPending: boolean;
  practitionerRewardGranted: boolean;
  betaRequestPending: boolean;
  betaRewardGranted: boolean;
  /** One-time store offer for sharing referral link (Share with a Link card). */
  shareLinkRewardClaimed: boolean;
  /** Unix ms when the user activated the one-time 7-day welcome Premium offer. */
  welcomePremiumClaimedAt: number | null;
  /** Campaign id for the welcome gift the user last claimed (null = never). */
  welcomePremiumCampaignId: string | null;
  /** Known expiry of the welcome gift (from RC or estimated). */
  welcomePremiumExpiresAtMs: number | null;
  welcomePremiumDayBeforeReminderShown: boolean;
  welcomePremiumExpiryDayReminderShown: boolean;
  /** Which premium-gift reminder is currently being shown. */
  activePremiumGiftReminder: PremiumGiftReminderKind | null;
  /** Bump to force-reset promo claim flags on next app launch (persisted). */
  promoClaimResetEpoch: number;

  setClipboardPromoCode(code: string | null): void;
  applyPromo(code: string, entitlement: PromoEntitlement, expiresAt?: number | null): void;
  markWelcomePremiumClaimed(): void;
  /** User saw or dismissed the welcome gift offer for the current campaign. */
  markWelcomePremiumOfferSeen(): void;
  setWelcomePremiumExpiresAtMs(expiresAtMs: number | null): void;
  markWelcomePremiumDayBeforeReminderShown(): void;
  markWelcomePremiumExpiryDayReminderShown(): void;
  setActivePremiumGiftReminder(kind: PremiumGiftReminderKind | null): void;
  clearPromo(): void;
  generateMyReferralCode(): void;
  setPendingReferrerCode(code: string): void;
  clearPendingReferrerCode(): void;
  checkInStreak(): void;
  ensureFirstInstallDate(): void;
  markReviewRewardClaimed(): void;
  markStreakReward7Claimed(): void;
  markStreakReward30Claimed(): void;
  markStreakBonusMilestoneClaimed(milestoneDay: number): void;
  markAnniversaryRewardClaimed(): void;
  markShareLinkRewardClaimed(): void;
  recordWellnessCheckin(): void;
  markPostSubmissionPending(): void;
  markPractitionerSubmissionPending(): void;
  markBetaRequestPending(): void;
  resetPromoClaimState(): void;
  syncPromoRewardStatuses(statuses: {
    post: 'none' | 'pending' | 'approved' | 'rejected';
    practitioner: 'none' | 'pending' | 'approved' | 'rejected';
    beta: 'none' | 'pending' | 'approved' | 'rejected';
  }): void;
};

export const createPromoSlice: StateCreator<AppStore, [], [], PromoSlice> = set => ({
  appliedPromoCode: null,
  appliedPromoEntitlement: null,
  appliedPromoExpiresAt: null,
  clipboardPromoCode: null,
  myReferralCode: null,
  pendingReferrerCode: null,
  streakDays: 0,
  lastStreakDate: null,
  firstInstallDate: null,
  reviewRewardClaimed: false,
  streakReward7Claimed: false,
  streakReward30Claimed: false,
  streakBonusMilestonesClaimed: [],
  anniversaryRewardClaimed: false,
  wellnessCheckinCount: 0,
  lastWellnessCheckinDate: null,
  postSubmissionPending: false,
  postRewardGranted: false,
  practitionerSubmissionPending: false,
  practitionerRewardGranted: false,
  betaRequestPending: false,
  betaRewardGranted: false,
  shareLinkRewardClaimed: false,
  welcomePremiumClaimedAt: null,
  welcomePremiumCampaignId: null,
  welcomePremiumExpiresAtMs: null,
  welcomePremiumDayBeforeReminderShown: false,
  welcomePremiumExpiryDayReminderShown: false,
  activePremiumGiftReminder: null,
  promoClaimResetEpoch: 0,

  applyPromo(code, entitlement, expiresAt = null) {
    const normalized = normalizePromoEntitlement(entitlement);
    if (normalized == null) {
      return;
    }
    const formatted = formatPromoCodeDisplay(code);
    set({
      appliedPromoCode: formatted,
      appliedPromoEntitlement: normalized,
      appliedPromoExpiresAt: expiresAt ?? null,
      clipboardPromoCode: formatted,
    });
  },

  setClipboardPromoCode(code) {
    const formatted = code == null ? null : formatPromoCodeDisplay(code);
    set({clipboardPromoCode: formatted});
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
      let code = 'HZ';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return {myReferralCode: code};
    });
  },

  setPendingReferrerCode(code) {
    const normalized = code.trim();
    if (normalized.length === 0) {
      return;
    }
    set(s => {
      if (s.pendingReferrerCode === normalized) {
        return {};
      }
      return {pendingReferrerCode: normalized};
    });
  },

  clearPendingReferrerCode() {
    set({pendingReferrerCode: null});
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
  markStreakBonusMilestoneClaimed(milestoneDay) {
    set(s => {
      if (s.streakBonusMilestonesClaimed.includes(milestoneDay)) {
        return {};
      }
      return {
        streakBonusMilestonesClaimed: [...s.streakBonusMilestonesClaimed, milestoneDay].sort(
          (a, b) => a - b,
        ),
      };
    });
  },
  markAnniversaryRewardClaimed() {
    set({anniversaryRewardClaimed: true});
  },
  markShareLinkRewardClaimed() {
    set({shareLinkRewardClaimed: true});
  },
  recordWellnessCheckin() {
    const today = new Date().toISOString().slice(0, 10);
    set(s => {
      if (s.lastWellnessCheckinDate != null && daysSince(s.lastWellnessCheckinDate) < 7) {
        return {};
      }
      return {
        wellnessCheckinCount: s.wellnessCheckinCount + 1,
        lastWellnessCheckinDate: today,
      };
    });
  },

  markPostSubmissionPending() {
    set({postSubmissionPending: true});
  },
  markPractitionerSubmissionPending() {
    set({practitionerSubmissionPending: true});
  },
  markBetaRequestPending() {
    set({betaRequestPending: true});
  },

  resetPromoClaimState() {
    set({
      reviewRewardClaimed: false,
      streakReward7Claimed: false,
      streakReward30Claimed: false,
      streakBonusMilestonesClaimed: [],
      anniversaryRewardClaimed: false,
      wellnessCheckinCount: 0,
      lastWellnessCheckinDate: null,
      shareLinkRewardClaimed: false,
      postSubmissionPending: false,
      postRewardGranted: false,
      practitionerSubmissionPending: false,
      practitionerRewardGranted: false,
      betaRequestPending: false,
      betaRewardGranted: false,
      appliedPromoCode: null,
      appliedPromoEntitlement: null,
      appliedPromoExpiresAt: null,
      clipboardPromoCode: null,
    });
  },

  resetOutreachPromoAttempts() {
    set({
      postSubmissionPending: false,
      postRewardGranted: false,
      practitionerSubmissionPending: false,
      practitionerRewardGranted: false,
      betaRequestPending: false,
      betaRewardGranted: false,
    });
  },

  syncPromoRewardStatuses(statuses) {
    set({
      postSubmissionPending: statuses.post === 'pending',
      postRewardGranted: statuses.post === 'approved',
      practitionerSubmissionPending: statuses.practitioner === 'pending',
      practitionerRewardGranted: statuses.practitioner === 'approved',
      betaRequestPending: statuses.beta === 'pending',
      betaRewardGranted: statuses.beta === 'approved',
    });
  },

  markWelcomePremiumClaimed() {
    set({
      welcomePremiumClaimedAt: Date.now(),
      welcomePremiumCampaignId: WELCOME_PREMIUM_CAMPAIGN,
      welcomePremiumDayBeforeReminderShown: false,
      welcomePremiumExpiryDayReminderShown: false,
    });
  },

  markWelcomePremiumOfferSeen() {
    set(s => {
      if (s.welcomePremiumCampaignId === WELCOME_PREMIUM_CAMPAIGN) {
        return {};
      }
      return {welcomePremiumCampaignId: WELCOME_PREMIUM_CAMPAIGN};
    });
  },

  setWelcomePremiumExpiresAtMs(expiresAtMs) {
    set({welcomePremiumExpiresAtMs: expiresAtMs});
  },

  markWelcomePremiumDayBeforeReminderShown() {
    set({welcomePremiumDayBeforeReminderShown: true});
  },

  markWelcomePremiumExpiryDayReminderShown() {
    set({welcomePremiumExpiryDayReminderShown: true});
  },

  setActivePremiumGiftReminder(kind) {
    set({activePremiumGiftReminder: kind});
  },
});

/** Returns how many full days since a given ISO 'YYYY-MM-DD' string. */
export function daysSince(isoDate: string): number {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  return Math.floor((now - then) / 86_400_000);
}
