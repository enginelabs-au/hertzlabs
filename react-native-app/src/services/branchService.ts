/**
 * Branch.io deep-link service.
 *
 * Generates referral links and subscribes to incoming deep links.
 * Falls back gracefully if the Branch SDK is not initialised (e.g. no key set yet).
 *
 * Setup required:
 *   1. Create a Branch.io account at https://branch.io
 *   2. Add your app (iOS + Android)
 *   3. Replace "key_live_REPLACE_WITH_YOUR_BRANCH_KEY" in:
 *        - ios/HertzLabsBinauralBeats/Info.plist
 *        - android/app/src/main/AndroidManifest.xml
 *   4. Configure your Branch link domain (e.g. hertzlabs.app.link) in the Branch dashboard
 *   5. For iOS Universal Links: add your domain to Associated Domains in Xcode
 *      (Signing & Capabilities → + Associated Domains → applinks:hertzlabs.app.link)
 */

import {Platform} from 'react-native';

let branch: typeof import('react-native-branch').default | null = null;

async function getBranch() {
  if (branch != null) return branch;
  try {
    const mod = await import('react-native-branch');
    branch = mod.default;
  } catch {
    branch = null;
  }
  return branch;
}

/**
 * Creates a Branch short link for the user's referral code.
 * Falls back to a plain HTTPS link if Branch is unavailable.
 */
export async function createReferralLink(referralCode: string): Promise<string> {
  const fallback = `https://hertzlabs.app?ref=${referralCode}`;
  try {
    const b = await getBranch();
    if (b == null) return fallback;

    const buo = await b.createBranchUniversalObject(`referral/${referralCode}`, {
      title: 'Try Hertz Labs',
      contentDescription: 'Binaural beats for focus, sleep & meditation.',
      contentMetadata: {
        customMetadata: {
          ref: referralCode,
          type: 'referral',
          platform: Platform.OS,
        },
      },
    });

    const {url} = await buo.generateShortUrl(
      {feature: 'referral', channel: 'share', campaign: 'user_referral'},
      {$desktop_url: fallback, $ios_url: fallback, $android_url: fallback},
    );
    return url ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Subscribe to incoming Branch deep links.
 * Returns an unsubscribe function.
 *
 * Call this in App.tsx on mount.
 */
export function subscribeToDeepLinks(
  onLink: (params: Record<string, string>) => void,
): () => void {
  let unsubscribe: (() => void) | null = null;

  void getBranch().then(b => {
    if (b == null) return;
    const sub = b.subscribe({
      onOpenComplete: ({params, error}) => {
        if (error != null || params == null) return;
        // Ignore click_timestamp etc; pass only custom metadata
        const custom: Record<string, string> = {};
        for (const [key, val] of Object.entries(params)) {
          if (!key.startsWith('+') && !key.startsWith('~') && !key.startsWith('$')) {
            custom[key] = String(val);
          }
        }
        if (Object.keys(custom).length > 0) {
          onLink(custom);
        }
      },
    });
    unsubscribe = sub;
  });

  return () => {
    unsubscribe?.();
  };
}
