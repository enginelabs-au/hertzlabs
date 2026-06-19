import type {SubscriptionTier} from '../state/types';

export type PremiumGiftReminderKind = 'dayBefore' | 'expiryDay';

const MS_PER_DAY = 86_400_000;

/** Local calendar day index (days since epoch in local TZ). */
function localDayIndex(ms: number): number {
  return Math.floor(new Date(ms).setHours(0, 0, 0, 0) / MS_PER_DAY);
}

/** Whole calendar days from `fromMs` until `toMs` (expiry). */
export function calendarDaysUntilExpiry(fromMs: number, expiryMs: number): number {
  return localDayIndex(expiryMs) - localDayIndex(fromMs);
}

export function resolvePremiumGiftReminder(input: {
  welcomePremiumClaimedAt: number | null;
  welcomePremiumExpiresAtMs: number | null;
  premiumExpiresAtMs: number | null;
  premiumIsPromotionalGift: boolean;
  tier: SubscriptionTier;
  dayBeforeShown: boolean;
  expiryDayShown: boolean;
  nowMs?: number;
}): PremiumGiftReminderKind | null {
  if (input.welcomePremiumClaimedAt == null) {
    return null;
  }

  const expiryMs = input.premiumExpiresAtMs ?? input.welcomePremiumExpiresAtMs;
  if (expiryMs == null) {
    return null;
  }

  const now = input.nowMs ?? Date.now();
  const daysUntil = calendarDaysUntilExpiry(now, expiryMs);

  if (input.tier === 'premium' && !input.premiumIsPromotionalGift) {
    return null;
  }

  if (
    !input.dayBeforeShown &&
    input.tier === 'premium' &&
    input.premiumIsPromotionalGift &&
    daysUntil === 1
  ) {
    return 'dayBefore';
  }

  const onExpiryDayWhileActive =
    !input.expiryDayShown &&
    input.tier === 'premium' &&
    input.premiumIsPromotionalGift &&
    daysUntil === 0;

  const lapsedGift =
    !input.expiryDayShown &&
    input.tier === 'free' &&
    daysUntil <= 0 &&
    now >= expiryMs - MS_PER_DAY;

  if (onExpiryDayWhileActive || lapsedGift) {
    return 'expiryDay';
  }

  return null;
}

export function parseRcExpirationMs(expirationDate: string | null | undefined): number | null {
  if (expirationDate == null || expirationDate.length === 0) {
    return null;
  }
  const ms = Date.parse(expirationDate);
  return Number.isFinite(ms) ? ms : null;
}

export function isPromotionalRcEntitlement(entitlement: {
  store?: string;
  periodType?: string;
  willRenew?: boolean;
}): boolean {
  const store = entitlement.store?.toUpperCase() ?? '';
  if (store === 'PROMOTIONAL') {
    return true;
  }
  const period = entitlement.periodType?.toUpperCase() ?? '';
  if (period === 'PROMOTIONAL') {
    return true;
  }
  return entitlement.willRenew === false && store !== 'APP_STORE' && store !== 'PLAY_STORE';
}
