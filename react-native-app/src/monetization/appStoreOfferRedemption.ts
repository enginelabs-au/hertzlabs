import {Linking, Platform} from 'react-native';
import Purchases from 'react-native-purchases';
import {isMacDesktopBuild} from '../platform/layoutProfile';
import {
  appleSubscriptionOfferRedeemUrl,
  googlePlayPromoRedeemUrl,
} from './storeOfferRedeemUrl';

export type StoreOfferRedemptionResult = {ok: true} | {ok: false; error: string};

async function openRedeemUrl(url: string, errorMessage: string): Promise<StoreOfferRedemptionResult> {
  try {
    const opened = await Linking.openURL(url);
    if (!opened) {
      return {ok: false, error: errorMessage};
    }
    return {ok: true};
  } catch {
    return {ok: false, error: errorMessage};
  }
}

/** Opens the platform store's native offer / promo code redemption flow. */
export async function presentStoreOfferRedemption(
  code?: string | null,
): Promise<StoreOfferRedemptionResult> {
  const trimmed = code?.trim();

  if (Platform.OS === 'android') {
    const url =
      trimmed != null && trimmed.length > 0
        ? googlePlayPromoRedeemUrl(trimmed)
        : 'https://play.google.com/redeem';
    return openRedeemUrl(url, 'Could not open Google Play redeem page.');
  }

  if (Platform.OS !== 'ios') {
    return {ok: false, error: 'Store offer redemption is not available on this platform.'};
  }

  // Subscription Offer Codes (ASC one-time batches) redeem reliably via deep link.
  if (trimmed != null && trimmed.length > 0) {
    return openRedeemUrl(
      appleSubscriptionOfferRedeemUrl(trimmed),
      'Could not open the App Store offer redemption page.',
    );
  }

  if (isMacDesktopBuild()) {
    return openRedeemUrl('https://apps.apple.com/redeem', 'Could not open the App Store redeem page.');
  }

  try {
    await Purchases.presentCodeRedemptionSheet();
    return {ok: true};
  } catch {
    return openRedeemUrl('https://apps.apple.com/redeem', 'Could not open App Store offer redemption.');
  }
}

/** @deprecated Use presentStoreOfferRedemption */
export async function presentAppStoreOfferRedemption(): Promise<StoreOfferRedemptionResult> {
  return presentStoreOfferRedemption();
}
