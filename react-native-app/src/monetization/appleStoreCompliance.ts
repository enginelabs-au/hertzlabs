import {Platform} from 'react-native';

/**
 * Custom HLP promo codes (validate-promo + RC promotional grant) are disabled on all platforms.
 * Premium rewards must use App Store Offer Codes or Google Play promo codes.
 */
export function allowsCustomPromoCodes(): boolean {
  return false;
}

/** Native store redemption UI (Apple sheet / redeem pages, Play Store redeem). */
export function usesStoreNativeRedemption(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** @deprecated Use usesStoreNativeRedemption */
export function usesAppStoreOfferRedemption(): boolean {
  return Platform.OS === 'ios';
}
