/** Strip dashes/spaces and uppercase for validation + storage. */
export function normalizePromoCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, '');
}

/** User-facing promo code (no dashes). */
export function formatPromoCodeDisplay(code: string): string {
  return normalizePromoCode(code);
}
