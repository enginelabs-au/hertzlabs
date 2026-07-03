/**
 * Referral deep links (incoming analytics) + store listing share with HZ code (outgoing).
 *
 * v3 manual referral: outgoing share includes store URL + HZ ID + Plans instructions.
 * Incoming deep links are logged for analytics only — they do not grant rewards.
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

export function referralShareMessage(referralCode: string): string {
  const link = storeListingUrl();
  return (
    `${SHARE_INTRO}\n\n` +
    `${link}\n\n` +
    `After install, open Hertz Labs → Plans → Referral and enter my code ${referralCode}.`
  );
}

/**
 * Opens the system share sheet with store URL + HZ referral instructions.
 * Returns true if the user completed a share action.
 */
export async function shareReferralListing(referralCode: string): Promise<boolean> {
  const message = referralShareMessage(referralCode);
  try {
    const result =
      Platform.OS === 'ios'
        ? await Share.share({message, url: storeListingUrl(), title: 'Hertz Labs'})
        : await Share.share({message});
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

/**
 * @deprecated Use shareReferralListing — store URL only, no HZ code.
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
