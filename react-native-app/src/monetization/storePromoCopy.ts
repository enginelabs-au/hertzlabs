import {Platform} from 'react-native';
import {isMacDesktopBuild} from '../platform/layoutProfile';

/** User-facing name of this device's subscription store. */
export function subscriptionStoreName(): string {
  if (Platform.OS === 'android') {
    return 'Google Play';
  }
  if (Platform.OS === 'ios') {
    return 'App Store';
  }
  return 'your subscription store';
}

/** User-facing label for reward codes on this platform. */
export function promoCodeNoun(): string {
  if (Platform.OS === 'android') {
    return 'Google Play promo code';
  }
  if (Platform.OS === 'ios') {
    return 'App Store offer code';
  }
  return 'promo code';
}

export function promoCodeEmailLine(): string {
  return `Your reward will be emailed as an ${promoCodeNoun()} within 24 hours — keep an eye on your inbox.`;
}

export function promoApprovedAlertBody(): string {
  return `Your reward was approved. Check your email for an ${promoCodeNoun()}, then tap Redeem below.`;
}

export function promoPendingReviewLine(): string {
  return `Submitted for review. We will email you an ${promoCodeNoun()} after approval — redeem it under Promos → Redeem.`;
}

export function promoRedeemFooter(): string {
  return `Have an ${promoCodeNoun()}? Redeem it here →`;
}

export function promoRedeemLegalNote(): string {
  if (Platform.OS === 'android') {
    return 'Reward codes are sent by email after approval. Redeem through Google Play — not inside this app.';
  }
  return 'Reward codes are sent by email after approval. Redeem through the App Store — not inside this app.';
}

export function outreachSubmitSuffix(): string {
  return `We will email you an ${promoCodeNoun()} after approval.`;
}

export function betaPendingNote(): string {
  return `Your beta request is under review. After approval, an ${promoCodeNoun()} will be emailed to you.`;
}

export function betaApprovedNote(): string {
  return `Beta reward approved — redeem your ${promoCodeNoun()} from the link below.`;
}

export function rateAppDescription(): string {
  if (Platform.OS === 'android') {
    return 'Rate Hertz Labs on Google Play.';
  }
  return 'Rate Hertz Labs on the App Store.';
}

export function welcomeGiftSubtitle(): string {
  if (Platform.OS === 'android') {
    return 'Start your complimentary week of Premium through Google Play — all engines, extended range, and background audio included.';
  }
  return 'Start your complimentary week of Premium through the App Store — all engines, extended range, and background audio included.';
}

export function welcomeGiftHero(): string {
  if (Platform.OS === 'android') {
    return 'Choose a plan below to start your 7-day free trial via Google Play. Cancel anytime during the trial — no charge until it ends.';
  }
  return 'Choose a plan below to start your 7-day free trial via the App Store. Cancel anytime during the trial — no charge until it ends.';
}

export function welcomeGiftFinePrint(): string {
  if (Platform.OS === 'android') {
    return 'One-time offer per account. Free trial is billed through your Google Play account after 7 days unless you cancel in Google Play → Subscriptions.';
  }
  return 'One-time offer per account. Free trial is billed through your Apple ID after 7 days unless you cancel in Settings → Subscriptions.';
}

/** Server-side: pick copy from client-reported platform string. */
export function promoCodeNounForPlatform(platform: string): string {
  const p = platform.toLowerCase();
  if (p.includes('android')) {
    return 'Google Play promo code';
  }
  if (p.includes('ios') || p.includes('mac') || p.includes('catalyst')) {
    return 'App Store offer code';
  }
  return 'store promo code';
}

export function subscriptionStoreNameForPlatform(platform: string): string {
  const p = platform.toLowerCase();
  if (p.includes('android')) {
    return 'Google Play';
  }
  if (p.includes('ios') || p.includes('mac') || p.includes('catalyst')) {
    return 'App Store';
  }
  return 'your subscription store';
}
