/**
 * Admin follow-up promo codes for outreach flows (post, practitioner, beta).
 * Seeded in migration 20260619220000_outreach_promo_codes.sql — keep in sync.
 */

export type OutreachPromoType = 'post' | 'practitioner' | 'beta';

/** Redeemable in-app (Promos → Redeem or Paywall promo field). */
export const OUTREACH_PROMO_CODES: Record<OutreachPromoType, string> = {
  post: 'HLP-K7M2-R9NX',
  practitioner: 'HLP-P3Q8-W4VT',
  beta: 'HLP-B6H9-N2JC',
};

const FLOW_LABEL: Record<OutreachPromoType, string> = {
  post: 'Make a Post',
  practitioner: 'Practitioner / Therapist',
  beta: 'Beta testing',
};

const REWARD_LABEL: Record<OutreachPromoType, string> = {
  post: '1 month of Hertz Labs Premium',
  practitioner: '3 months of Hertz Labs Premium',
  beta: '1 month of Hertz Labs Premium',
};

export function outreachRewardLabel(type: OutreachPromoType): string {
  return REWARD_LABEL[type];
}

export function outreachPromoCode(type: OutreachPromoType): string {
  return OUTREACH_PROMO_CODES[type];
}

export function outreachFlowLabel(type: OutreachPromoType): string {
  return FLOW_LABEL[type];
}

/** Subject suffix so the reward code is visible in the inbox list. */
export function outreachSubjectTag(type: OutreachPromoType): string {
  return `[SEND: ${outreachPromoCode(type)}]`;
}

/** Primary admin block — promo code first; plain text for clients that strip HTML. */
export function outreachPromoBlockHtml(type: OutreachPromoType): string {
  const code = outreachPromoCode(type);
  const reward = outreachRewardLabel(type);
  const flow = outreachFlowLabel(type);
  return `<div style="margin:0 0 20px;padding:20px;background:#1a1b2e;border:2px solid #FBBF24;border-radius:10px">
<h2 style="margin:0 0 12px;color:#FBBF24;font-size:18px">Reward code for ${flow}</h2>
<p style="margin:0 0 8px;font-size:15px;color:#fff"><b>Copy this code into your reply to the user</b> (this is NOT their in-app “Refer a friend” code):</p>
<p style="margin:12px 0;padding:12px;background:#0D0E18;border-radius:8px;font-family:ui-monospace,monospace;font-size:24px;letter-spacing:2px;color:#FBBF24;text-align:center">${code}</p>
<p style="margin:0 0 8px;color:#ccc;font-size:14px">Unlocks: <b>${reward}</b></p>
<p style="margin:0;color:#aaa;font-size:13px">User redeems in app: <b>Promos → Redeem</b> or the paywall promo field. Replying to this email does <b>not</b> approve or grant Premium — use the green approve button below or send the code above.</p>
</div>
<p style="font-family:ui-monospace,monospace;font-size:14px;color:#888">Plain text: ${code}</p>`;
}

/** Optional note when the submitter’s in-app share code is present (not for rewards). */
export function userShareCodeNoteHtml(userShareCode: string | null | undefined): string {
  const code = String(userShareCode ?? '').trim();
  if (code.length === 0) {
    return '';
  }
  return `<p style="color:#666;font-size:12px"><b>User’s in-app share code (do not send as reward):</b> ${code}</p>`;
}
