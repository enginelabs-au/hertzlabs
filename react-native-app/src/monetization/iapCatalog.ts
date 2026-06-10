/**
 * App Store / Play Store product identifiers — must match ASC exactly.
 *
 * monthly/annual use `hertzlabs_premium_*` because the original IDs
 * (`hertzlabs_monthly_premium`, `hertzlabs_annual_premium`) were created as
 * Consumables; Apple never allows reusing a Product ID after assignment.
 */
export const IAP_PRODUCT_IDS = {
  monthly: 'hertzlabs_premium_monthly',
  annual: 'hertzlabs_premium_annual',
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
export const IAP_SETUP_CHECKLIST = [
  `App Store Connect → Subscriptions: delete any Consumable drafts for ${IAP_PRODUCT_IDS.monthly} / ${IAP_PRODUCT_IDS.annual}, then create both as Auto-Renewable Subscriptions in one Subscription Group (not Consumables).`,
  `App Store Connect → In-App Purchases: keep ${IAP_PRODUCT_IDS.lifetime} as Non-Consumable only. Fill metadata until all 3 show "Ready to Submit".`,
  'App Store Connect → Agreements, Tax, and Banking: Paid Apps Agreement must be Active (signed).',
  'RevenueCat → your iOS app uses bundle ID com.hertzlabs.binauralbeats and has App Store Connect credentials (API key or shared secret) so products can sync.',
  `RevenueCat → Products: import/sync the 3 products from App Store Connect.`,
  `RevenueCat → Entitlements → "${REVENUECAT_ENTITLEMENT}": attach all 3 products.`,
  `RevenueCat → Offerings → "${REVENUECAT_OFFERING}": add packages ${REVENUECAT_PACKAGES.monthly}, ${REVENUECAT_PACKAGES.annual}, ${REVENUECAT_PACKAGES.lifetime}, then mark "${REVENUECAT_OFFERING}" as Current.`,
  'Wait 15–60 minutes after changes, then tap Retry on this screen.',
  'Sandbox test (after plans load): iPhone Settings → App Store → Sandbox Account → sign in with a Sandbox Tester from App Store Connect.',
] as const;
