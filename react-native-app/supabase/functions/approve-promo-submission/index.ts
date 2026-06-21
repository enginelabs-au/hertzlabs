/**
 * Hertz Labs — approve-promo-submission
 *
 * GET /functions/v1/approve-promo-submission?type=post|practitioner|beta&id=UUID&token=SECRET
 *
 * Admin one-click approve from review email. Grants RevenueCat Premium and marks approved.
 * Set PROMO_APPROVE_SECRET in Supabase secrets.
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {escapeHtml, sendResendEmail} from '../_shared/resend.ts';
import {grantRcPremiumForMs, RC_GRANT_DURATIONS_MS} from '../_shared/rcGrant.ts';
import {
  outreachPromoCode,
  outreachRewardLabel,
  type OutreachPromoType,
} from '../_shared/outreachPromo.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APPROVE_SECRET = Deno.env.get('PROMO_APPROVE_SECRET') ?? '';

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const GRANT_MS: Record<string, number> = {
  post: ONE_MONTH_MS,
  practitioner: RC_GRANT_DURATIONS_MS.threeMonth,
  beta: ONE_MONTH_MS,
};

const TABLE: Record<string, string> = {
  post: 'post_submissions',
  practitioner: 'practitioner_applications',
  beta: 'app_messages',
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') {
    return htmlPage('Method not allowed', 'Use the approve link from the review email.', false);
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? '';
  const id = url.searchParams.get('id') ?? '';
  const token = url.searchParams.get('token') ?? '';

  if (!(type in TABLE) || id.length === 0) {
    return htmlPage('Invalid request', 'Missing or invalid type/id.', false);
  }
  const outreachType = type as OutreachPromoType;
  if (APPROVE_SECRET.length === 0 || token !== APPROVE_SECRET) {
    return htmlPage('Unauthorized', 'Invalid approve token.', false);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const table = TABLE[type];

  const {data: row, error} = await sb.from(table).select('*').eq('id', id).single();
  if (error != null || row == null) {
    return htmlPage('Not found', 'Submission could not be found.', false);
  }

  if (row.status === 'approved') {
    return htmlPage('Already approved', 'This submission was already approved.', true);
  }

  const rcUserId = String(row.rc_user_id ?? '').trim();
  if (rcUserId.length === 0) {
    return htmlPage(
      'Missing account id',
      'No RevenueCat user id on this submission — ask the user to reopen the app and resubmit.',
      false,
    );
  }

  const durationMs = GRANT_MS[type];
  const grant = await grantRcPremiumForMs(rcUserId, durationMs);
  if (!grant.ok) {
    return htmlPage('Grant failed', grant.error, false);
  }

  await sb.from(table).update({status: 'approved'}).eq('id', id);

  const replyEmail =
    type === 'practitioner'
      ? String(row.email ?? '').trim()
      : type === 'beta'
        ? String(row.from_email ?? '').trim()
        : '';

  if (replyEmail.length > 0) {
    const rewardLabel = outreachRewardLabel(outreachType);
    const promoCode = outreachPromoCode(outreachType);
    await sendResendEmail({
      to: replyEmail,
      subject: 'Hertz Labs — your reward is active',
      html: `<p>Hi,</p>
<p>Thanks for being part of Hertz Labs. Your submission has been approved and <b>${escapeHtml(rewardLabel)}</b> has been added to your account.</p>
<p>Open the app — Premium should be active now. If it does not appear within a minute, fully close and reopen the app.</p>
<p style="margin-top:16px">If Premium is not showing, redeem this code in the app (<b>Promos → Redeem</b> or the paywall promo field):</p>
<p style="font-family:ui-monospace,monospace;font-size:18px;color:#FBBF24">${escapeHtml(promoCode)}</p>
<p>— Hertz Labs</p>`,
    });
  }

  return htmlPage(
    'Approved',
    `Premium granted for RC user ${escapeHtml(rcUserId)}.`,
    true,
  );
});

function htmlPage(title: string, detail: string, ok: boolean): Response {
  const color = ok ? '#34D399' : '#F87171';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:system-ui,sans-serif;background:#0D0E18;color:#fff;padding:32px">
<h1 style="color:${color}">${escapeHtml(title)}</h1>
<p>${detail}</p>
</body></html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: {'Content-Type': 'text/html; charset=utf-8'},
  });
}
