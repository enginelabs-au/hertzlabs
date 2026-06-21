/**
 * Referral deep links without a third-party attribution SDK.
 *
 * Share URL:  https://enginelabs-au.github.io/hertzlabs/r/?ref=HZ-XXXXXX
 * App scheme: hertzlabs://open?ref=HZ-XXXXXX
 *
 * The /r/ landing page (docs/r/index.html) tries the custom scheme, then falls
 * back to App Store / Play Store.
 */

import {Linking} from 'react-native';

/** Public referral landing page (GitHub Pages). */
export const REFERRAL_LANDING_BASE = 'https://enginelabs-au.github.io/hertzlabs/r/';

/** Custom URI scheme registered in iOS Info.plist + Android manifest. */
export const APP_SCHEME = 'hertzlabs';

/** Builds the shareable HTTPS referral link for a user's code. */
export function createReferralLink(referralCode: string): string {
  const code = referralCode.trim();
  return `${REFERRAL_LANDING_BASE}?ref=${encodeURIComponent(code)}`;
}

/** Builds the in-app custom-scheme link (used by the web landing page). */
export function createAppSchemeReferralLink(referralCode: string): string {
  return `${APP_SCHEME}://open?ref=${encodeURIComponent(referralCode.trim())}`;
}

/**
 * Extracts a referral code from HTTPS links or custom-scheme URLs.
 * Supported:
 *   https://enginelabs-au.github.io/hertzlabs/r/?ref=HZ-ABC
 *   https://enginelabs-au.github.io/hertzlabs/r/HZ-ABC
 *   hertzlabs://open?ref=HZ-ABC
 */
export function parseReferralFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const fromQuery = parsed.searchParams.get('ref') ?? parsed.searchParams.get('referral_code');
    if (fromQuery != null && fromQuery.trim().length > 0) {
      return fromQuery.trim();
    }

    if (parsed.protocol === `${APP_SCHEME}:`) {
      const fromPath = parsed.pathname.replace(/^\//, '').trim();
      if (fromPath.length > 0 && fromPath !== 'open') {
        return fromPath;
      }
    }

    const pathMatch = parsed.pathname.match(/\/r\/([^/?#]+)/i);
    if (pathMatch?.[1] != null) {
      return decodeURIComponent(pathMatch[1]).trim();
    }
  } catch {
    // ignore malformed URLs
  }
  return null;
}

/**
 * Subscribe to cold-start and warm deep links via React Native Linking.
 * Returns an unsubscribe function.
 */
export function subscribeToReferralLinks(onReferral: (referralCode: string) => void): () => void {
  const handle = (url: string | null | undefined) => {
    if (url == null || url.length === 0) {
      return;
    }
    const ref = parseReferralFromUrl(url);
    if (ref != null) {
      onReferral(ref);
    }
  };

  void Linking.getInitialURL().then(handle);
  const sub = Linking.addEventListener('url', event => handle(event.url));
  return () => sub.remove();
}
