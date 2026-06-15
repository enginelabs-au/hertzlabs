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
  `Google Play Console → Monetize → Subscriptions: create ${IAP_PRODUCT_IDS.monthly} and ${IAP_PRODUCT_IDS.annual} (same IDs as iOS).`,
  `Google Play Console → Monetize → In-app products: create ${IAP_PRODUCT_IDS.lifetime} as a one-time product.`,
  'Google Play Console → link a payments profile and publish the app to at least Internal testing (draft SKUs alone are not enough).',
  'RevenueCat → add Android app (package com.hertzlabs.binauralbeats) with the Google Play service credentials JSON.',
  'RevenueCat → Products: import/sync the 3 Play products, attach to entitlement "premium", and add packages to offering "default".',
  'Set REVENUECAT_API_KEY_ANDROID (goog_…) in react-native-app/.env and rebuild the app.',
  'Test on a Play-enabled device/emulator signed into Play Store; add your Google account as a License tester in Play Console.',
  'Wait 15–60 minutes after Play + RevenueCat changes, then tap Retry on the paywall.',
] as const;
