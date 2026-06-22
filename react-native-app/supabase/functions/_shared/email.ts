export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export const OUTREACH_PROMO_CATEGORIES = new Set([
  'promo_post',
  'promo_practitioner',
  'promo_beta',
]);
