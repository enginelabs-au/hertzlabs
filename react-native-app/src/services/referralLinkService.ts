/**
 * Referral deep links (incoming) + store listing share (outgoing).
 *
 * Outgoing share uses the App Store / Google Play listing for this device only —
 * no copy-paste codes or landing-page URLs.
 *
 * Incoming attribution still accepts legacy landing-page and custom-scheme links.
 */

import {Linking, Platform, Share} from 'react-native';
import {APP_STORE_URL, PLAY_STORE_URL} from '../constants/appInfo';

/** @deprecated Legacy landing page — still parsed for incoming links. */
export const REFERRAL_LANDING_BASE = 'https://enginelabs-au.github.io/hertzlabs/r/';

export const APP_SCHEME = 'hertzlabs';

const SHARE_INTRO = 'Try Hertz Labs — binaural beats for focus, sleep & meditation.';

/** Direct store listing URL for the current platform. */
export function storeListingUrl(): string {
  return Platform.OS === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
}

export function storeListingShareLabel(): string {
  return Platform.OS === 'android' ? 'Share on Google Play' : 'Share App Store Link';
}

/**
 * Opens the system share sheet with a single store link (no duplicate URL on iOS).
 * Returns true if the user completed a share action.
 */
export async function shareStoreListing(): Promise<boolean> {
  const link = storeListingUrl();
  try {
    const result =
      Platform.OS === 'ios'
        ? await Share.share({url: link, title: 'Hertz Labs'})
        : await Share.share({message: `${SHARE_INTRO}\n${link}`});
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

/** @deprecated Use storeListingUrl() — kept for legacy callers. */
export function createReferralLink(_referralCode: string): string {
  return storeListingUrl();
}

export function createAppSchemeReferralLink(referralCode: string): string {
  return `${APP_SCHEME}://open?ref=${encodeURIComponent(referralCode.trim())}`;
}

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
