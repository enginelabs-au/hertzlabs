import type {StateCreator} from 'zustand';
import type {AppStore, SubscriptionSlice} from '../types';
import type {CustomerInfo} from 'react-native-purchases';
import {
  isPromotionalRcEntitlement,
  parseRcExpirationMs,
} from '../../monetization/premiumGiftReminders';

type RcEntitlementFields = {
  expirationDate?: string | null;
  store?: string;
  periodType?: string;
  willRenew?: boolean;
};

export const createSubscriptionSlice: StateCreator<AppStore, [], [], SubscriptionSlice> = (
  set,
  get,
) => ({
  tier: 'free',
  entitlements: [],
  premiumExpiresAtMs: null,
  premiumIsPromotionalGift: false,

  setSubscription: (tier, entitlements) =>
    set({
      tier,
      entitlements,
      ...(tier === 'free'
        ? {experimentalMode: false, premiumIsPromotionalGift: false}
        : {}),
    }),

  _hydrateFromRC: (info: CustomerInfo, entitlementId = 'premium') => {
    const active = Object.keys(info.entitlements.active);
    const entitlement = info.entitlements.active[entitlementId] as RcEntitlementFields | undefined;
    const tier = active.includes(entitlementId) ? 'premium' : 'free';

    let premiumExpiresAtMs: number | null = null;
    let premiumIsPromotionalGift = false;

    if (entitlement != null) {
      premiumExpiresAtMs = parseRcExpirationMs(entitlement.expirationDate);
      premiumIsPromotionalGift = isPromotionalRcEntitlement(entitlement);
    }

    set({
      entitlements: active,
      tier,
      premiumExpiresAtMs,
      premiumIsPromotionalGift,
      ...(tier === 'free' ? {experimentalMode: false} : {}),
    });

    const state = get();
    if (
      premiumExpiresAtMs != null &&
      premiumIsPromotionalGift &&
      state.welcomePremiumClaimedAt != null &&
      state.welcomePremiumExpiresAtMs == null
    ) {
      set({welcomePremiumExpiresAtMs: premiumExpiresAtMs});
    }
  },
});
