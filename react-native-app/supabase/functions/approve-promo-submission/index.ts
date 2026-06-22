/**
 * Hertz Labs — approve-promo-submission (deprecated)
 *
 * Legacy one-click approve links are disabled. Premium is granted only when the user
 * redeems an App Store Offer Code or Google Play promo code you send by email.
 *
 * GET still marks the submission approved in Supabase (for in-app status UI) but does
 * NOT grant RevenueCat promotional entitlements.
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {escapeHtml} from '../_shared/resend.ts';
import {outreachRewardLabel, type OutreachPromoType} from '../_shared/outreachPromo.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APPROVE_SECRET = Deno.env.get('PROMO_APPROVE_SECRET') ?? '';

const TABLE: Record<string, string> = {
  post: 'post_submissions',
  practitioner: 'practitioner_applications',
  beta: 'app_messages',
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') {
    return htmlPage('Method not allowed', 'This endpoint only accepts GET from legacy links.', false);
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
    return htmlPage('Unauthorized', 'Invalid or expired link.', false);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const table = TABLE[type];

  const {data: row, error} = await sb.from(table).select('*').eq('id', id).single();
  if (error != null || row == null) {
    return htmlPage('Not found', 'Submission could not be found.', false);
  }

  if (row.status !== 'approved') {
    await sb.from(table).update({status: 'approved'}).eq('id', id);
  }

  const rewardLabel = outreachRewardLabel(outreachType);
  return htmlPage(
    'Marked approved',
    `Submission marked approved in the app. Send the user an App Store or Google Play promo code by email — ${escapeHtml(rewardLabel)} unlocks when they redeem through the store. Automatic Premium grants are disabled.`,
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
