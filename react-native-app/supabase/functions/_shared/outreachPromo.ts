/**
 * Admin follow-up for outreach flows (post, practitioner, beta).
 * Store offer codes are reserved from store_offer_code_pool (CSV import).
 */

import {escapeHtml} from './resend.ts';
import {
  type OutreachCodeBundle,
  redeemUrlForCode,
  type StoreOfferAllocation,
} from './allocateStoreOfferCode.ts';
import {normalizeOutreachPlatform, outreachPlatformLabel, storeForOutreachPlatform} from './outreachPlatform.ts';

export type OutreachPromoType = 'post' | 'practitioner' | 'beta';

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

export function outreachFlowLabel(type: OutreachPromoType): string {
  return FLOW_LABEL[type];
}

/** Subject suffix — includes primary code when allocated. */
export function outreachSubjectTag(type: OutreachPromoType, primaryCode?: string | null): string {
  if (primaryCode != null && primaryCode.length > 0) {
    return `[REWARD: ${FLOW_LABEL[type]} — ${primaryCode}]`;
  }
  return `[REWARD: ${FLOW_LABEL[type]} — NO CODE IN POOL]`;
}

function codeBlockHtml(allocation: StoreOfferAllocation, platformLabel: string): string {
  const storeLabel = allocation.store === 'apple' ? 'App Store offer code' : 'Google Play promo code';
  const url = redeemUrlForCode(allocation.store, allocation.code);
  return `<div style="margin:12px 0;padding:16px;background:#0D0E18;border-radius:8px;border:1px solid rgba(251,191,36,0.35)">
<p style="margin:0 0 4px;color:#aaa;font-size:12px;text-transform:uppercase;letter-spacing:1px">${storeLabel} · ${escapeHtml(platformLabel)}</p>
<p style="margin:0;padding:12px;background:#000;border-radius:6px;font-family:ui-monospace,monospace;font-size:22px;letter-spacing:2px;color:#FBBF24;text-align:center">${escapeHtml(allocation.code)}</p>
<p style="margin:10px 0 0;font-size:12px;color:#888">Redeem link: <a href="${escapeHtml(url)}" style="color:#7dd3fc">${escapeHtml(url)}</a></p>
</div>`;
}

function stockWarningHtml(bundle: OutreachCodeBundle, platform: string): string {
  const lines: string[] = [];
  const store = storeForOutreachPlatform(platform);
  if (bundle.primary == null) {
    if (normalizeOutreachPlatform(platform) == null) {
      lines.push(
        '<p style="color:#F87171;font-weight:700">Platform missing or unrecognized — no code reserved. Ask the user which device they use (iOS, Android, or macOS).</p>',
      );
    } else {
      lines.push(
        '<p style="color:#F87171;font-weight:700">No code could be reserved for this platform — import more codes (see import-store-offer-codes.mjs).</p>',
      );
    }
  }
  if (store === 'apple' && bundle.appleRemaining < 10) {
    lines.push(`<p style="color:#FBBF24;font-size:12px">Low stock: ${bundle.appleRemaining} Apple codes left for this reward tier.</p>`);
  }
  if (store === 'google' && bundle.googleRemaining < 10) {
    lines.push(`<p style="color:#FBBF24;font-size:12px">Low stock: ${bundle.googleRemaining} Google codes left for this reward tier.</p>`);
  }
  return lines.join('');
}

/** Primary admin block with auto-allocated store code for submitter platform only. */
export function outreachPromoBlockHtml(
  type: OutreachPromoType,
  bundle: OutreachCodeBundle,
  platform = '',
): string {
  const reward = outreachRewardLabel(type);
  const flow = outreachFlowLabel(type);
  const platformLabel = outreachPlatformLabel(platform);
  const canonical = normalizeOutreachPlatform(platform);
  const platformNote = `<p style="margin:0 0 12px;color:#ccc;font-size:14px"><b>User platform:</b> ${escapeHtml(platformLabel)}${canonical != null ? ` <span style="color:#888">(${canonical})</span>` : ''}</p>`;

  const codesHtml =
    bundle.primary != null ? codeBlockHtml(bundle.primary, platformLabel) : '';

  return `<div style="margin:0 0 20px;padding:20px;background:#1a1b2e;border:2px solid #FBBF24;border-radius:10px">
<h2 style="margin:0 0 12px;color:#FBBF24;font-size:18px">Reward for ${flow}</h2>
<p style="margin:0 0 8px;font-size:15px;color:#fff"><b>Copy the code below into your reply</b> after you approve the submission.</p>
<p style="margin:0 0 12px;color:#ccc;font-size:14px">Unlocks: <b>${reward}</b></p>
${platformNote}
${codesHtml}
${stockWarningHtml(bundle, platform)}
<p style="margin:12px 0 0;color:#aaa;font-size:13px;line-height:1.5">User redeems in app: <b>Promos → Redeem</b>. Then set submission status to <b>approved</b> in Supabase if desired.</p>
</div>
<p style="font-family:ui-monospace,monospace;font-size:13px;color:#888">Reply template: “Thanks! Open Hertz Labs → Promos → Redeem and enter: [CODE above]”</p>`;
}
