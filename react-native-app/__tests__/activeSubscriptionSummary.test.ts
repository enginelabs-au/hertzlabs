import {describe, expect, it} from 'vitest';
import {summarizeActiveSubscription} from '../src/monetization/activeSubscriptionSummary';
import type {CustomerInfo, PurchasesEntitlementInfo} from 'react-native-purchases';

function makeEntitlement(overrides: Partial<PurchasesEntitlementInfo>): PurchasesEntitlementInfo {
  return {
    identifier: 'premium',
    isActive: true,
    willRenew: true,
    periodType: 'NORMAL',
    latestPurchaseDate: '2026-06-01T00:00:00Z',
    latestPurchaseDateMillis: 0,
    originalPurchaseDate: '2026-06-01T00:00:00Z',
    originalPurchaseDateMillis: 0,
    expirationDate: '2026-07-01T00:00:00Z',
    expirationDateMillis: 0,
    store: 'APP_STORE',
    productIdentifier: 'hertzlabs_bb_monthly',
    productPlanIdentifier: null,
    isSandbox: false,
    unsubscribeDetectedAt: null,
    unsubscribeDetectedAtMillis: null,
    billingIssueDetectedAt: null,
    billingIssueDetectedAtMillis: null,
    ownershipType: 'PURCHASED',
    verification: 0,
    ...overrides,
  } as PurchasesEntitlementInfo;
}

function makeCustomerInfo(entitlement: PurchasesEntitlementInfo | null): CustomerInfo {
  const active = entitlement ? {premium: entitlement} : {};
  return {
    entitlements: {active, all: active, verification: 0},
    activeSubscriptions: entitlement ? [entitlement.productIdentifier] : [],
    allPurchasedProductIdentifiers: entitlement ? [entitlement.productIdentifier] : [],
    latestExpirationDate: entitlement?.expirationDate ?? null,
    firstSeen: '2026-01-01T00:00:00Z',
    originalAppUserId: 'user',
    requestDate: '2026-06-10T00:00:00Z',
    allExpirationDates: {},
    allPurchaseDates: {},
    originalApplicationVersion: null,
    originalPurchaseDate: null,
    managementURL: 'https://apps.apple.com/account/subscriptions',
    nonSubscriptionTransactions: [],
    subscriptionsByProductIdentifier: {},
  } as CustomerInfo;
}

describe('summarizeActiveSubscription', () => {
  it('reports free tier when entitlement is inactive', () => {
    const summary = summarizeActiveSubscription(makeCustomerInfo(null));
    expect(summary.isPremium).toBe(false);
    expect(summary.statusLine).toContain('No active');
  });

  it('maps monthly subscription with renewal date', () => {
    const summary = summarizeActiveSubscription(
      makeCustomerInfo(makeEntitlement({productIdentifier: 'hertzlabs_bb_monthly'})),
    );
    expect(summary.isPremium).toBe(true);
    expect(summary.planLabel).toBe('Monthly');
    expect(summary.planKey).toBe('monthly');
    expect(summary.statusLine).toContain('Renews');
  });

  it('reports lifetime access without expiration', () => {
    const summary = summarizeActiveSubscription(
      makeCustomerInfo(
        makeEntitlement({
          productIdentifier: 'hertzlabs_lifetime_ultra',
          expirationDate: null,
          willRenew: false,
        }),
      ),
    );
    expect(summary.planLabel).toBe('Lifetime Ultra');
    expect(summary.statusLine).toContain('Lifetime');
  });
});
