import type {CustomerInfo, PurchasesEntitlementInfo} from 'react-native-purchases';
import {IAP_PRODUCT_IDS, REVENUECAT_ENTITLEMENT} from './iapCatalog';
import type {PaywallPlanKey} from './loadPaywallPackages';

export type ActiveSubscriptionSummary = {
  planLabel: string;
  planKey: PaywallPlanKey | null;
  productId: string;
  statusLine: string;
  detailLines: string[];
  isPremium: boolean;
  isTrial: boolean;
  willRenew: boolean;
  expirationLabel: string | null;
  managementURL: string | null;
  purchasedProductIds: string[];
};

function productIdToPlanKey(productId: string): PaywallPlanKey | null {
  if (productId === IAP_PRODUCT_IDS.monthly) {
    return 'monthly';
  }
  if (productId === IAP_PRODUCT_IDS.annual) {
    return 'annual';
  }
  if (productId === IAP_PRODUCT_IDS.lifetime) {
    return 'lifetime';
  }
  return null;
}

function productIdToPlanLabel(productId: string): string {
  const key = productIdToPlanKey(productId);
  if (key === 'monthly') {
    return 'Monthly';
  }
  if (key === 'annual') {
    return 'Annual';
  }
  if (key === 'lifetime') {
    return 'Lifetime Ultra';
  }
  return productId;
}

function formatRcDate(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function buildStatusLines(entitlement: PurchasesEntitlementInfo): {
  statusLine: string;
  detailLines: string[];
  expirationLabel: string | null;
} {
  const expirationLabel = formatRcDate(entitlement.expirationDate);
  const detailLines: string[] = [];
  const isLifetime = entitlement.expirationDate == null && entitlement.productIdentifier === IAP_PRODUCT_IDS.lifetime;

  if (isLifetime) {
    return {
      statusLine: 'Lifetime access — no expiration',
      detailLines: [`Purchased ${formatRcDate(entitlement.originalPurchaseDate) ?? '—'}`],
      expirationLabel: null,
    };
  }

  if (entitlement.periodType === 'TRIAL') {
    detailLines.push('You are in a free trial period.');
    return {
      statusLine: expirationLabel
        ? `Trial ends ${expirationLabel}`
        : 'Free trial active',
      detailLines,
      expirationLabel,
    };
  }

  if (entitlement.willRenew && expirationLabel) {
    return {
      statusLine: `Renews ${expirationLabel}`,
      detailLines,
      expirationLabel,
    };
  }

  if (expirationLabel) {
    detailLines.push('Auto-renew is off for this subscription.');
    return {
      statusLine: `Active until ${expirationLabel}`,
      detailLines,
      expirationLabel,
    };
  }

  return {
    statusLine: 'Premium active',
    detailLines,
    expirationLabel: null,
  };
}

export function summarizeActiveSubscription(
  info: CustomerInfo | null,
  entitlementId = REVENUECAT_ENTITLEMENT,
): ActiveSubscriptionSummary {
  const purchasedProductIds = info?.allPurchasedProductIdentifiers ?? [];
  const entitlement = info?.entitlements.active[entitlementId];
  const isPremium = entitlement?.isActive === true;

  if (!isPremium || !entitlement) {
    return {
      planLabel: 'Free',
      planKey: null,
      productId: '',
      statusLine: 'No active Premium subscription',
      detailLines: purchasedProductIds.length
        ? [`Purchased products: ${purchasedProductIds.join(', ')}`]
        : [],
      isPremium: false,
      isTrial: false,
      willRenew: false,
      expirationLabel: null,
      managementURL: info?.managementURL ?? null,
      purchasedProductIds,
    };
  }

  const {statusLine, detailLines, expirationLabel} = buildStatusLines(entitlement);

  if (entitlement.billingIssueDetectedAt) {
    detailLines.push('Billing issue detected — update payment in the App Store.');
  }
  if (entitlement.unsubscribeDetectedAt && entitlement.willRenew === false) {
    detailLines.push('Cancellation scheduled — access continues until expiration.');
  }
  if (entitlement.isSandbox) {
    detailLines.push('Sandbox purchase (testing).');
  }

  return {
    planLabel: productIdToPlanLabel(entitlement.productIdentifier),
    planKey: productIdToPlanKey(entitlement.productIdentifier),
    productId: entitlement.productIdentifier,
    statusLine,
    detailLines,
    isPremium: true,
    isTrial: entitlement.periodType === 'TRIAL',
    willRenew: entitlement.willRenew,
    expirationLabel,
    managementURL: info?.managementURL ?? null,
    purchasedProductIds,
  };
}
