/**
 * Minimal type stub for react-native-purchases (RevenueCat SDK).
 * Replace with the full package types once npm install + pod install are run.
 */
declare module 'react-native-purchases' {
  export interface EntitlementInfo {
    identifier: string;
    isActive: boolean;
    willRenew: boolean;
    productIdentifier: string;
  }

  export interface EntitlementsInfo {
    active: Record<string, EntitlementInfo>;
    all: Record<string, EntitlementInfo>;
  }

  export interface CustomerInfo {
    entitlements: EntitlementsInfo;
    activeSubscriptions: string[];
    allPurchasedProductIdentifiers: string[];
    originalAppUserId: string;
  }

  const Purchases: {
    configure(config: {apiKey: string}): void;
    getCustomerInfo(): Promise<CustomerInfo>;
    addCustomerInfoUpdateListener(listener: (info: CustomerInfo) => void): (() => void) | void;
  };

  export default Purchases;
}
