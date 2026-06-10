import {useEffect} from 'react';
import {LogBox} from 'react-native';
import Purchases from 'react-native-purchases';
import {REVENUECAT_ENTITLEMENT_ID} from '@env';
import {ensureRevenueCatConfigured} from '../../monetization/revenueCatReady';
import {useHertzStore} from '../../state/store';

const DEFAULT_ENTITLEMENT = 'premium';

function resolveEntitlementId(): string {
  return REVENUECAT_ENTITLEMENT_ID?.trim() || DEFAULT_ENTITLEMENT;
}

/**
 * Configures RevenueCat once and hydrates subscription state from CustomerInfo.
 */
export function useRevenueCatBoot(): void {
  useEffect(() => {
    if (__DEV__) {
      LogBox.ignoreLogs(['[RevenueCat]']);
    }

    const entitlementId = resolveEntitlementId();
    const {_hydrateFromRC} = useHertzStore.getState();

    const onCustomerInfoUpdate = (info: Parameters<typeof _hydrateFromRC>[0]) => {
      _hydrateFromRC(info, entitlementId);
    };

    let unsubscribe: (() => void) | void;
    void ensureRevenueCatConfigured().then(ok => {
      if (!ok) {
        return;
      }
      void Purchases.getCustomerInfo()
        .then(info => onCustomerInfoUpdate(info))
        .catch(() => {
          /* offline / sandbox — keep free tier */
        });
      unsubscribe = Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdate);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);
}
