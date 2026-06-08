import type {StateCreator} from 'zustand';
import type {AppStore, SubscriptionSlice} from '../types';
import type {CustomerInfo} from 'react-native-purchases';

export const createSubscriptionSlice: StateCreator<AppStore, [], [], SubscriptionSlice> = set => ({
  tier: 'free',
  entitlements: [],

  setSubscription: (tier, entitlements) =>
    set({
      tier,
      entitlements,
      ...(tier === 'free' ? {experimentalMode: false} : {}),
    }),

  _hydrateFromRC: (info: CustomerInfo, entitlementId = 'premium') => {
    const active = Object.keys(info.entitlements.active);
    const tier = active.includes(entitlementId) ? 'premium' : 'free';
    set({
      entitlements: active,
      tier,
      ...(tier === 'free' ? {experimentalMode: false} : {}),
    });
  },
});
