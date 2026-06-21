/** Vitest / Node test runner only — not used in RN production bundles */
declare const process: {env?: Record<string, string | undefined>};

declare module '@env' {
  export const REVENUECAT_API_KEY_IOS: string | undefined;
  export const REVENUECAT_API_KEY_ANDROID: string | undefined;
  export const REVENUECAT_ENTITLEMENT_ID: string | undefined;
  export const GEMINI_API_KEY: string | undefined;
  export const PROMO_VALIDATE_URL: string | undefined;
  export const WELCOME_PREMIUM_URL: string | undefined;
  export const WELLNESS_CHECKIN_URL: string | undefined;
  export const APP_VERSION_CHECK_URL: string | undefined;
}
