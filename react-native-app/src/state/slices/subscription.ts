import type {StateCreator} from 'zustand';
import type {AppStore, SubscriptionSlice} from '../types';
import type {CustomerInfo} from 'react-native-purchases';

export const createSubscriptionSlice: StateCreator<AppStore, [], [], SubscriptionSlice> = set => ({
  tier: 'free',
  entitlements: [],

  setSubscription: (tier, entitlements) => set({tier, entitlements}),

  _hydrateFromRC: (info: CustomerInfo, entitlementId = 'pro') => {
    const active = Object.keys(info.entitlements.active);
    set({
      entitlements: active,
      tier: active.includes(entitlementId) ? 'premium' : 'free',
    });
  },
});
