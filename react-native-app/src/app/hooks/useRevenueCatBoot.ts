import {useEffect, useRef} from 'react';
import {LogBox, Platform} from 'react-native';
import Purchases from 'react-native-purchases';
import {
  REVENUECAT_API_KEY_ANDROID,
  REVENUECAT_API_KEY_IOS,
  REVENUECAT_ENTITLEMENT_ID,
} from '@env';
import {useHertzStore} from '../../state/store';

const DEFAULT_ENTITLEMENT = 'premium';

function resolveApiKey(): string {
  const ios = REVENUECAT_API_KEY_IOS?.trim() ?? '';
  const android = REVENUECAT_API_KEY_ANDROID?.trim() ?? '';
  return Platform.OS === 'android' ? android : ios;
}

function resolveEntitlementId(): string {
  return REVENUECAT_ENTITLEMENT_ID?.trim() || DEFAULT_ENTITLEMENT;
}

/**
 * Configures RevenueCat once and hydrates subscription state from CustomerInfo.
 */
export function useRevenueCatBoot(): void {
  const configured = useRef(false);

  useEffect(() => {
    if (configured.current) {
      return;
    }
    const apiKey = resolveApiKey();
    if (!apiKey) {
      return;
    }

    if (__DEV__) {
      LogBox.ignoreLogs(['[RevenueCat]']);
    }

    configured.current = true;
    const entitlementId = resolveEntitlementId();
    const {_hydrateFromRC} = useHertzStore.getState();

    const onCustomerInfoUpdate = (info: Parameters<typeof _hydrateFromRC>[0]) => {
      _hydrateFromRC(info, entitlementId);
    };

    try {
      Purchases.configure({apiKey});
      void Purchases.getCustomerInfo()
        .then(info => onCustomerInfoUpdate(info))
        .catch(() => {
          /* offline / sandbox — keep free tier */
        });
      const unsubscribe = Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdate);
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    } catch {
      configured.current = false;
    }
  }, []);
}
