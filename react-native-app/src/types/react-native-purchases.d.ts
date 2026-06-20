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

  /** iOS only — a promotional offer / introductory discount attached to a product */
  export interface PurchasesStoreProductDiscount {
    identifier: string;
    price: number;
    priceString: string;
    cycles: number;
    period: string;
    periodUnit: string;
    periodNumberOfUnits: number;
  }

  /** Android only — a single priced phase within a subscription option */
  export interface PricingPhase {
    billingPeriod: string;
    billingCycleCount: number | null;
    price: {formatted: string; amountMicros: number; currencyCode: string};
    recurrenceMode: number;
  }

  /**
   * Android only — one offer within a base plan.
   * `id` is the full compound identifier: `productId:basePlanId:offerId`
   */
  export interface SubscriptionOption {
    id: string;
    storeProductId: string;
    productId: string;
    pricingPhases: PricingPhase[];
  }

  export interface PurchasesStoreProduct {
    productIdentifier: string;
    localizedDescription: string;
    localizedTitle: string;
    price: number;
    priceString: string;
    currencyCode: string;
    subscriptionPeriod?: string;
    /** iOS promotional / introductory offers on this product */
    discounts?: PurchasesStoreProductDiscount[];
    /** Android subscription offers available for this product */
    subscriptionOptions?: SubscriptionOption[];
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

  /**
   * A signed promotional offer returned by `getPromotionalOffer`.
   * iOS only — pass to `purchaseDiscountedPackage`.
   */
  export interface PurchasesPromotionalOffer {
    identifier: string;
    keyIdentifier: string;
    nonce: string;
    signature: string;
    timestamp: number;
  }

  const Purchases: {
    configure(config: {apiKey: string; appUserID?: string}): void;
    getCustomerInfo(): Promise<CustomerInfo>;
    getOfferings(): Promise<PurchasesOfferings>;
    /** Standard purchase with no offer applied */
    purchasePackage(pkg: Package): Promise<MakePurchaseResult>;
    /**
     * iOS only — purchase a package with a signed promotional offer.
     * Obtain `promotionalOffer` via `getPromotionalOffer` first.
     */
    purchaseDiscountedPackage(
      pkg: Package,
      promotionalOffer: PurchasesPromotionalOffer,
    ): Promise<MakePurchaseResult>;
    /**
     * iOS only — resolves a signed `PurchasesPromotionalOffer` for a given
     * product discount. Returns `undefined` if the offer cannot be applied.
     */
    getPromotionalOffer(
      product: PurchasesStoreProduct,
      discount: PurchasesStoreProductDiscount,
    ): Promise<PurchasesPromotionalOffer | undefined>;
    /**
     * Android only — purchase using a specific subscription option (base plan + offer).
     * Allows selecting a promotional offer by its compound offer ID.
     */
    purchaseSubscriptionOption(subscriptionOption: SubscriptionOption): Promise<MakePurchaseResult>;
    restorePurchases(): Promise<CustomerInfo>;
    syncPurchases(): Promise<CustomerInfo>;
    invalidateCustomerInfoCache(): Promise<void>;
    addCustomerInfoUpdateListener(listener: (info: CustomerInfo) => void): (() => void) | void;
    setLogLevel(level: 'VERBOSE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT'): void;
  };

  export default Purchases;
}
