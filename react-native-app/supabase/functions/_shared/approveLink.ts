import {outreachPromoBlockHtml, type OutreachPromoType} from './outreachPromo.ts';

const FUNCTIONS_BASE =
  Deno.env.get('SUPABASE_URL') != null && Deno.env.get('SUPABASE_URL')!.length > 0
    ? `${Deno.env.get('SUPABASE_URL')!.replace(/\/$/, '')}/functions/v1`
    : 'https://mvawkzhwgtlwxwkssvyg.supabase.co/functions/v1';

export function approveLink(type: OutreachPromoType, id: string): string | null {
  const secret = Deno.env.get('PROMO_APPROVE_SECRET') ?? '';
  if (secret.length === 0 || id.length === 0) {
    return null;
  }
  const params = new URLSearchParams({type, id, token: secret});
  return `${FUNCTIONS_BASE}/approve-promo-submission?${params.toString()}`;
}

export function approveLinkHtml(type: OutreachPromoType, id: string): string {
  const promoBlock = outreachPromoBlockHtml(type);
  const link = approveLink(type, id);
  const approveSection =
    link == null
      ? `<p style="color:#888">One-click approve unavailable — send the reward code above in your reply.</p>`
      : `<p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#34D399;color:#0D0E18;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px">Approve &amp; grant Premium automatically</a></p>
<p style="color:#888;font-size:12px">Optional: click to grant Premium without the user entering a code. Email reply alone does not approve.</p>`;
  return `${promoBlock}
<hr style="border:none;border-top:1px solid #333;margin:20px 0">
${approveSection}`;
}

/** Admin review email wrapper — reward code always at the top. */
export function adminReviewEmailHtml(type: OutreachPromoType, bodyHtml: string, id?: string): string {
  const header = id != null ? approveLinkHtml(type, id) : outreachPromoBlockHtml(type);
  return `${header}
<hr style="border:none;border-top:1px solid #333;margin:20px 0">
${bodyHtml}`;
}
