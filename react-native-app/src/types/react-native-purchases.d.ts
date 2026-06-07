/**
 * Type stub for react-native-purchases (RevenueCat SDK v8+).
 * Extended to cover the full surface used in PaywallScreen.
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

  export interface PurchasesStoreProduct {
    productIdentifier: string;
    localizedDescription: string;
    localizedTitle: string;
    price: number;
    priceString: string;
    currencyCode: string;
    subscriptionPeriod?: string;
  }

  export type PackageType =
    | 'UNKNOWN'
    | 'CUSTOM'
    | 'LIFETIME'
    | 'ANNUAL'
    | 'SIX_MONTH'
    | 'THREE_MONTH'
    | 'TWO_MONTH'
    | 'MONTHLY'
    | 'WEEKLY';

  export interface Package {
    identifier: string;
    packageType: PackageType;
    product: PurchasesStoreProduct;
    offeringIdentifier: string;
  }

  export interface PurchasesOffering {
    identifier: string;
    serverDescription: string;
    availablePackages: Package[];
    lifetime: Package | null;
    annual: Package | null;
    sixMonth: Package | null;
    threeMonth: Package | null;
    twoMonth: Package | null;
    monthly: Package | null;
    weekly: Package | null;
  }

  export interface PurchasesOfferings {
    current: PurchasesOffering | null;
    all: Record<string, PurchasesOffering>;
  }

  export interface MakePurchaseResult {
    productIdentifier: string;
    customerInfo: CustomerInfo;
    transaction: Record<string, unknown>;
  }

  const Purchases: {
    configure(config: {apiKey: string; appUserID?: string}): void;
    getCustomerInfo(): Promise<CustomerInfo>;
    getOfferings(): Promise<PurchasesOfferings>;
    purchasePackage(pkg: Package): Promise<MakePurchaseResult>;
    restorePurchases(): Promise<CustomerInfo>;
    addCustomerInfoUpdateListener(listener: (info: CustomerInfo) => void): (() => void) | void;
    setLogLevel(level: 'VERBOSE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT'): void;
  };

  export default Purchases;
}
