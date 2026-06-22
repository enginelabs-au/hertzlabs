import {APP_STORE_ID} from '../constants/appInfo';

/** Apple Subscription Offer Code redemption URL (one-time use codes from ASC). */
export function appleSubscriptionOfferRedeemUrl(code: string): string {
  return `https://apps.apple.com/redeem?ctx=offercodes&id=${APP_STORE_ID}&code=${encodeURIComponent(code.trim())}`;
}

export function googlePlayPromoRedeemUrl(code: string): string {
  return `https://play.google.com/redeem?code=${encodeURIComponent(code.trim())}`;
}
