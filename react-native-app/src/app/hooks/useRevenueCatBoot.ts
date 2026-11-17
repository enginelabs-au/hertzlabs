import {useEffect} from 'react';
import {LogBox} from 'react-native';
import Purchases from 'react-native-purchases';
import {REVENUECAT_ENTITLEMENT_ID} from '@env';
import {ensureRevenueCatConfigured} from '../../monetization/revenueCatReady';
import {posthog} from '../../config/posthog';
import {posthogLog} from '../../config/posthogLogger';
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

    let identifiedDistinctId: string | null = null;

    const identifyRevenueCatUser = (info: Parameters<typeof _hydrateFromRC>[0]) => {
      const distinctId = info.originalAppUserId?.trim();
      if (
        distinctId == null ||
        distinctId.length === 0 ||
        distinctId === identifiedDistinctId
      ) {
        return;
      }
      posthog?.identify(distinctId, {
        $set: {billing_provider: 'revenuecat'},
      });
      identifiedDistinctId = distinctId;
    };

    const onCustomerInfoUpdate = (info: Parameters<typeof _hydrateFromRC>[0]) => {
      identifyRevenueCatUser(info);
      _hydrateFromRC(info, entitlementId);
    };

    let unsubscribe: (() => void) | void;
    void ensureRevenueCatConfigured().then(ok => {
      if (!ok) {
        posthogLog.warn('billing_sdk_unavailable', {provider: 'revenuecat'});
        return;
      }
      posthogLog.info('billing_sdk_configured', {provider: 'revenuecat'});
      void Purchases.getCustomerInfo()
        .then(info => {
          onCustomerInfoUpdate(info);
          posthogLog.info('billing_customer_info_loaded', {provider: 'revenuecat'});
        })
        .catch(() => {
          posthogLog.warn('billing_customer_info_unavailable', {
            operation: 'get_customer_info',
            provider: 'revenuecat',
          });
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
