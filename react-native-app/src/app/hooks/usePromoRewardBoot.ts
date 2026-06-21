import {useEffect} from 'react';
import Purchases from 'react-native-purchases';
import {REVENUECAT_ENTITLEMENT_ID} from '@env';
import {refreshRcEntitlements} from '../../monetization/promoCodeService';
import {fetchPromoRewardStatus} from '../../promos/checkPromoRewards';
import {useHertzStore} from '../../state/store';

const DEFAULT_ENTITLEMENT = 'premium';

function resolveEntitlementId(): string {
  return REVENUECAT_ENTITLEMENT_ID?.trim() || DEFAULT_ENTITLEMENT;
}

/** After RC is configured, sync admin-approved outreach rewards and refresh tier. */
export function usePromoRewardBoot(): void {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await new Promise(r => setTimeout(r, 1500));
      if (cancelled) {
        return;
      }
      const statuses = await fetchPromoRewardStatus();
      if (cancelled || statuses == null) {
        return;
      }
      useHertzStore.getState().syncPromoRewardStatuses(statuses);
      if (
        statuses.post === 'approved' ||
        statuses.practitioner === 'approved' ||
        statuses.beta === 'approved'
      ) {
        const refreshed = await refreshRcEntitlements();
        if (refreshed) {
          try {
            const info = await Purchases.getCustomerInfo();
            useHertzStore.getState()._hydrateFromRC(info, resolveEntitlementId());
          } catch {
            /* offline */
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
