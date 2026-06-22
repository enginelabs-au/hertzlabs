/** Platform-specific promo copy for edge functions (no React Native). */

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

export function outreachSuccessMessage(platform: string): string {
  const noun = promoCodeNounForPlatform(platform);
  return `Request sent for review. We will email you an ${noun} after approval — redeem it in the app under Promos → Redeem.`;
}
