import {Linking, Platform} from 'react-native';
import Purchases from 'react-native-purchases';
import type {ActiveSubscriptionSummary} from '../monetization/activeSubscriptionSummary';
import {usesStoreNativeRedemption} from '../monetization/appleStoreCompliance';
import {IAP_PRODUCT_IDS, normalizeStoreProductId} from '../monetization/iapCatalog';

export function canShowCancellationWinback(summary: ActiveSubscriptionSummary): boolean {
  if (!usesStoreNativeRedemption()) {
    return false;
  }
  if (!summary.isPremium || summary.isPromotionalGift) {
    return false;
  }
  const productId = normalizeStoreProductId(summary.productId);
  if (productId === IAP_PRODUCT_IDS.lifetime) {
    return false;
  }
  return summary.managementURL != null || Platform.OS !== 'web';
}

export async function openNativeSubscriptionManagement(
  managementURL: string | null,
): Promise<void> {
  if (managementURL != null) {
    await Linking.openURL(managementURL);
    return;
  }
  if (typeof Purchases.showManageSubscriptions === 'function') {
    await Purchases.showManageSubscriptions();
  }
}
