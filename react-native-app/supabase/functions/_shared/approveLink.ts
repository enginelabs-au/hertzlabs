import type {OutreachCodeBundle} from './allocateStoreOfferCode.ts';
import {outreachPromoBlockHtml, type OutreachPromoType} from './outreachPromo.ts';

/** Admin review email wrapper — allocated store code(s) at the top. */
export function adminReviewEmailHtml(
  type: OutreachPromoType,
  bodyHtml: string,
  bundle: OutreachCodeBundle,
  platform = '',
): string {
  return `${outreachPromoBlockHtml(type, bundle, platform)}
<hr style="border:none;border-top:1px solid #333;margin:20px 0">
${bodyHtml}`;
}
