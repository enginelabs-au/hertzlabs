import {Platform} from 'react-native';
import Purchases, {
  PRODUCT_CATEGORY,
  type Package,
  type PurchasesOffering,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import {
  IAP_PRODUCT_IDS,
  REVENUECAT_OFFERING,
  REVENUECAT_PACKAGES,
  iapProductId,
} from './iapCatalog';
import {ensureRevenueCatConfigured} from './revenueCatReady';

export type PaywallPlanKey = 'monthly' | 'annual' | 'lifetime';

export type PaywallPlan = {
  key: PaywallPlanKey;
  label: string;
  period: string;
  badge?: string;
  highlighted?: boolean;
  pkg: Package | null;
  storeProduct: PurchasesStoreProduct | null;
  price: string;
};

export type PaywallLoadResult =
  | {status: 'ready'; offering: PurchasesOffering | null; plans: PaywallPlan[]}
  | {status: 'not_configured'}
  | {status: 'store_unavailable'; detail: string; plans: PaywallPlan[]}
  | {status: 'error'; message: string};

const PLAN_META: Record<
  PaywallPlanKey,
  Pick<PaywallPlan, 'label' | 'period' | 'badge' | 'highlighted'>
> = {
  monthly: {label: 'Monthly', period: '/ month', badge: '7-day free trial'},
  annual: {
    label: 'Annual',
    period: '/ year',
    badge: 'Best value · 7-day free trial',
    highlighted: true,
  },
  lifetime: {
    label: 'Lifetime',
    period: 'one-time',
    badge: 'Pay once, own forever',
  },
};

function findOfferingPackage(
  offering: PurchasesOffering,
  rcIdentifier: string,
  packageType: Package['packageType'],
  productId: string,
): Package | undefined {
  return offering.availablePackages.find(
    p =>
      p.identifier === rcIdentifier ||
      p.packageType === packageType ||
      p.product.productIdentifier === productId,
  );
}

function fallbackPrice(key: PaywallPlanKey): string {
  if (key === 'monthly') return '$4.99';
  if (key === 'annual') return '$24.99';
  return '$19.99';
}

function planFromPackage(key: PaywallPlanKey, pkg: Package): PaywallPlan {
  return {
    key,
    ...PLAN_META[key],
    pkg,
    storeProduct: null,
    price: pkg.product.priceString,
  };
}

function planFromStoreProduct(key: PaywallPlanKey, product: PurchasesStoreProduct): PaywallPlan {
  return {
    key,
    ...PLAN_META[key],
    pkg: null,
    storeProduct: product,
    price: product.priceString,
  };
}

async function loadStoreProducts(): Promise<Map<string, PurchasesStoreProduct>> {
  const map = new Map<string, PurchasesStoreProduct>();
  const os = Platform.OS === 'android' ? 'android' : 'ios';
  const [subs, inApp] = await Promise.all([
    Purchases.getProducts(
      [iapProductId('monthly', os), iapProductId('annual', os)],
      PRODUCT_CATEGORY.SUBSCRIPTION,
    ),
    Purchases.getProducts([iapProductId('lifetime', os)], PRODUCT_CATEGORY.NON_SUBSCRIPTION),
  ]);
  for (const product of [...subs, ...inApp]) {
    map.set(product.productIdentifier, product);
  }
  return map;
}

function storeUnavailableDetail(): string {
  if (Platform.OS === 'android') {
    return (
      'RevenueCat is configured, but Google Play has not returned your products yet. ' +
      'Create the 3 products in Play Console, connect Play to RevenueCat, publish to Internal testing, ' +
      'set REVENUECAT_API_KEY_ANDROID in .env, rebuild, and sign into Play Store on the device. ' +
      'Emulators without Play Store or billing cannot load real plans.'
    );
  }
  return (
    'RevenueCat is configured, but the App Store has not returned your products yet. ' +
    'In App Store Connect, confirm all three products are Ready to Submit, attach them to your app version, ' +
    'then wait up to an hour and retry. For sandbox testing, sign in under Settings → App Store → Sandbox Account.'
  );
}

function buildFallbackPlans(
  packagePlans: Partial<Record<PaywallPlanKey, PaywallPlan>>,
): PaywallPlan[] {
  return (['monthly', 'annual', 'lifetime'] as PaywallPlanKey[]).map(key => {
    const plan = packagePlans[key];
    if (plan) {
      return plan;
    }
    return {
      key,
      ...PLAN_META[key],
      pkg: null,
      storeProduct: null,
      price: fallbackPrice(key),
    };
  });
}

async function resolveOfferingPackages(): Promise<{
  offering: PurchasesOffering | null;
  packagePlans: Partial<Record<PaywallPlanKey, PaywallPlan>>;
  offeringsError: string | null;
}> {
  const packagePlans: Partial<Record<PaywallPlanKey, PaywallPlan>> = {};
  let offeringsError: string | null = null;
  let offering: PurchasesOffering | null = null;

  try {
    const offerings = await Purchases.getOfferings();
    offering =
      offerings.current ??
      offerings.all?.[REVENUECAT_OFFERING] ??
      Object.values(offerings.all ?? {}).find(o => o.availablePackages.length > 0) ??
      null;

    if (__DEV__) {
      console.log(
        '[Paywall] getOfferings:',
        offering?.identifier ?? 'none',
        'packages:',
        offering?.availablePackages.length ?? 0,
      );
    }

    if (offering) {
      const os = Platform.OS === 'android' ? 'android' : 'ios';
      const defs: Array<{
        key: PaywallPlanKey;
        rcId: string;
        type: Package['packageType'];
        productId: string;
      }> = [
        {key: 'monthly', rcId: REVENUECAT_PACKAGES.monthly, type: 'MONTHLY', productId: iapProductId('monthly', os)},
        {key: 'annual', rcId: REVENUECAT_PACKAGES.annual, type: 'ANNUAL', productId: iapProductId('annual', os)},
        {key: 'lifetime', rcId: REVENUECAT_PACKAGES.lifetime, type: 'LIFETIME', productId: iapProductId('lifetime', os)},
      ];
      for (const def of defs) {
        const pkg = findOfferingPackage(offering, def.rcId, def.type, def.productId);
        if (pkg) {
          packagePlans[def.key] = planFromPackage(def.key, pkg);
        }
      }
    }
  } catch (e) {
    offeringsError = e instanceof Error ? e.message : String(e);
    if (__DEV__) {
      console.warn('[Paywall] getOfferings failed (will try StoreKit direct):', offeringsError);
    }
  }

  return {offering, packagePlans, offeringsError};
}

export async function loadPaywallPackages(): Promise<PaywallLoadResult> {
  const configured = await ensureRevenueCatConfigured();
  if (!configured) {
    return {status: 'not_configured'};
  }

  try {
    const {offering, packagePlans, offeringsError} = await resolveOfferingPackages();

    const missingKeys = (['monthly', 'annual', 'lifetime'] as PaywallPlanKey[]).filter(
      k => packagePlans[k] == null,
    );

    if (missingKeys.length > 0) {
      try {
        const storeProducts = await loadStoreProducts();
        if (__DEV__) {
          console.log(
            '[Paywall] getProducts:',
            [...storeProducts.keys()].join(', ') || 'none',
          );
        }
        for (const key of missingKeys) {
          const os = Platform.OS === 'android' ? 'android' : 'ios';
          const productId = iapProductId(key, os);
          const product = storeProducts.get(productId);
          if (product) {
            packagePlans[key] = planFromStoreProduct(key, product);
          }
        }
      } catch (e) {
        if (__DEV__) {
          console.warn('[Paywall] getProducts failed:', e);
        }
      }
    }

    const plans = buildFallbackPlans(packagePlans);
    const purchasable = plans.filter(p => p.pkg != null || p.storeProduct != null);
    if (purchasable.length === 0) {
      const unavailableDetail = storeUnavailableDetail();
      const detail = offeringsError
        ? `${unavailableDetail}\n\nSDK: ${offeringsError}`
        : unavailableDetail;
      return {status: 'store_unavailable', plans, detail};
    }

    return {status: 'ready', offering, plans};
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not load subscription plans.';
    return {status: 'error', message};
  }
}
