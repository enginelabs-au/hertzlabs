/**
 * App Store / Play Store product identifiers — must match ASC exactly.
 *
 * Subscription IDs use `hertzlabs_bb_*` — `hertzlabs_premium_monthly` /
 * `hertzlabs_premium_annual` were burned when created as Consumables (Apple never
 * recycles Product IDs). Older IDs: `hertzlabs_monthly_premium`, `hertzlabs_annual_premium`.
 */
export const IAP_PRODUCT_IDS = {
  monthly: 'hertzlabs_bb_monthly',
  annual: 'hertzlabs_bb_annual',
  lifetime: 'hertzlabs_lifetime_ultra',
} as const;

/** Play subscriptions use `subscriptionId:basePlanId` (must match setup-play-iap.mjs). */
export const PLAY_SUBSCRIPTION_BASE_PLAN_ID = 'default';

export const PLAY_IAP_PRODUCT_IDS = {
  monthly: `${IAP_PRODUCT_IDS.monthly}:${PLAY_SUBSCRIPTION_BASE_PLAN_ID}`,
  annual: `${IAP_PRODUCT_IDS.annual}:${PLAY_SUBSCRIPTION_BASE_PLAN_ID}`,
  lifetime: IAP_PRODUCT_IDS.lifetime,
} as const;

export type IapProductKey = keyof typeof IAP_PRODUCT_IDS;

export function iapProductId(key: IapProductKey, os: 'ios' | 'android'): string {
  return os === 'android' ? PLAY_IAP_PRODUCT_IDS[key] : IAP_PRODUCT_IDS[key];
}

/** Strip `:basePlanId` suffix when comparing Play subscription IDs to catalog keys. */
export function normalizeStoreProductId(productId: string): string {
  const colon = productId.indexOf(':');
  return colon >= 0 ? productId.slice(0, colon) : productId;
}

export const REVENUECAT_ENTITLEMENT = 'premium';
export const REVENUECAT_OFFERING = 'default';

export const REVENUECAT_PACKAGES = {
  monthly: '$rc_monthly',
  annual: '$rc_annual',
  lifetime: '$rc_lifetime',
} as const;

/** Shown on paywall when offerings cannot load — dashboard setup, not a code bug. */
export const APP_STORE_SETUP_CHECKLIST = [
  `App Store Connect → Subscriptions: ${IAP_PRODUCT_IDS.monthly} and ${IAP_PRODUCT_IDS.annual} must be Auto-Renewable Subscriptions in one group (never Consumables — Apple burns Product IDs permanently).`,
  `App Store Connect → In-App Purchases: keep ${IAP_PRODUCT_IDS.lifetime} as Non-Consumable only. Fill metadata until all 3 show "Ready to Submit".`,
  'App Store Connect → Agreements, Tax, and Banking: Paid Apps Agreement must be Active (signed).',
  'RevenueCat → your iOS app uses bundle ID com.hertzlabs.binauralbeats and has App Store Connect credentials (API key or shared secret) so products can sync.',
  `RevenueCat → Products: import/sync the 3 products from App Store Connect.`,
  `RevenueCat → Entitlements → "${REVENUECAT_ENTITLEMENT}": attach all 3 products.`,
  `RevenueCat → Offerings → "${REVENUECAT_OFFERING}": add packages ${REVENUECAT_PACKAGES.monthly}, ${REVENUECAT_PACKAGES.annual}, ${REVENUECAT_PACKAGES.lifetime}, then mark "${REVENUECAT_OFFERING}" as Current.`,
  'Wait 15–60 minutes after changes, then tap Retry on this screen.',
  'Sandbox test (after plans load): iPhone Settings → App Store → Sandbox Account → sign in with a Sandbox Tester from App Store Connect.',
] as const;

/** @deprecated Use {@link APP_STORE_SETUP_CHECKLIST} */
export const IAP_SETUP_CHECKLIST = APP_STORE_SETUP_CHECKLIST;

/** Google Play + RevenueCat Android — required before plans load on Android. */
export const PLAY_STORE_SETUP_CHECKLIST = [
  'Google Play Console → set up a payments profile (required before billing).',
  `Subscriptions (Monetize with Play → Products → Subscriptions): create subscription product IDs ${IAP_PRODUCT_IDS.monthly} and ${IAP_PRODUCT_IDS.annual}, then for each add an auto-renewing base plan with ID "${PLAY_SUBSCRIPTION_BASE_PLAN_ID}", set price/availability, and Activate the base plan.`,
  `Optional 7-day trial: on each base plan add an offer (Add offer → new customer acquisition → Free trial phase 7 days) and Activate the offer. Do not mention trial/price in subscription Benefits text (Google policy).`,
  `One-time product (Monetize with Play → Products → One-time products): create ${IAP_PRODUCT_IDS.lifetime} with a Buy purchase option, set price, and Activate.`,
  `RevenueCat store IDs for subscriptions use productId:basePlanId — ${PLAY_IAP_PRODUCT_IDS.monthly}, ${PLAY_IAP_PRODUCT_IDS.annual}; lifetime is ${PLAY_IAP_PRODUCT_IDS.lifetime}.`,
  'Upload signed AAB to at least Internal testing; add license testers under Setup → License testing.',
  'RevenueCat → Android app: service credentials JSON + Pub/Sub RTDN (Monetize with Play → Monetization setup → topic from RC).',
  'RevenueCat catalog is wired via npm run fix:revenuecat:android; rebuild after REVENUECAT_API_KEY_ANDROID is in .env.',
  'Wait 15–60 minutes after Play + RevenueCat changes, then tap Retry on the paywall.',
] as const;
