/**
 * Hertz Labs — send-app-message
 *
 * POST /functions/v1/send-app-message
 * In-app feedback / contact messages → Resend → hello@ or support@ enginelabs.com.au
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {adminReviewEmailHtml} from '../_shared/approveLink.ts';
import {
  allocateOutreachCodes,
  type OutreachCodeBundle,
} from '../_shared/allocateStoreOfferCode.ts';
import {outreachSubjectTag, type OutreachPromoType} from '../_shared/outreachPromo.ts';
import {outreachSuccessMessage} from '../_shared/storePromoCopy.ts';
import {outreachPlatformLabel} from '../_shared/outreachPlatform.ts';
import {escapeHtml, sendResendEmail} from '../_shared/resend.ts';
import {isValidEmail, OUTREACH_PROMO_CATEGORIES} from '../_shared/email.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const TO_MAP = {
  hello: 'hello@enginelabs.com.au',
  support: 'support@enginelabs.com.au',
} as const;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_MESSAGE = 8000;
const MIN_MESSAGE = 8;

type Recipient = keyof typeof TO_MAP;

const PROMO_CATEGORY: Record<string, OutreachPromoType> = {
  promo_post: 'post',
  promo_practitioner: 'practitioner',
  promo_beta: 'beta',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  if (req.method !== 'POST') return json({error: 'Method not allowed.'}, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({error: 'Invalid JSON body.'}, 400);
  }

  const toKey = body.to as Recipient | undefined;
  if (toKey == null || !(toKey in TO_MAP)) {
    return json({error: 'Invalid recipient.'}, 400);
  }

  const subject = String(body.subject ?? '').trim();
  const message = String(body.message ?? '').trim();
  const category = String(body.category ?? 'general').trim().slice(0, 64);
  const fromEmail = String(body.from_email ?? '').trim();
  const platform = String(body.platform ?? '').trim().slice(0, 32);
  const appVersion = String(body.app_version ?? '').trim().slice(0, 32);
  const rcUserId = String(body.rc_user_id ?? '').trim() || null;

  if (subject.length < 3 || subject.length > 200) {
    return json({error: 'Subject is required.'}, 400);
  }
  if (message.length < MIN_MESSAGE || message.length > MAX_MESSAGE) {
    return json({error: `Message must be ${MIN_MESSAGE}–${MAX_MESSAGE} characters.`}, 400);
  }
  const outreachType = PROMO_CATEGORY[category];
  const isOutreachPromo = outreachType != null || OUTREACH_PROMO_CATEGORIES.has(category);
  const isAffiliateApply = category === 'feedback_affiliate_apply';
  if (isAffiliateApply && !isValidEmail(fromEmail)) {
    return json({error: 'A valid email is required for affiliate applications.'}, 400);
  }
  if (isOutreachPromo && !isValidEmail(fromEmail)) {
    return json({error: 'A valid email is required so we can send your offer code.'}, 400);
  }
  if (fromEmail.length > 0 && !isValidEmail(fromEmail)) {
    return json({error: 'Invalid reply email address.'}, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let approveId: string | undefined;
  if (outreachType === 'post') {
    const postUrl = extractLine(message, 'Post URL:') ?? '(see message)';
    const platformLine = extractLine(message, 'Platform:');
    const {data: row, error} = await sb
      .from('post_submissions')
      .insert({
        post_url: postUrl,
        platform: platformLine,
        description: message,
        email: fromEmail,
        rc_user_id: rcUserId,
      })
      .select('id')
      .single();
    if (error != null) {
      console.error('[send-app-message] post_submissions insert:', error);
    } else {
      approveId = row?.id as string;
    }
  } else if (outreachType === 'practitioner') {
    const fullName = extractLine(message, 'Name:') ?? '(see message)';
    const {data: row, error} = await sb
      .from('practitioner_applications')
      .insert({
        full_name: fullName,
        credentials: extractLine(message, 'Credentials / role:'),
        practice: extractLine(message, 'Practice / organisation:'),
        website: extractLine(message, 'Website:'),
        email: fromEmail || '(unknown)',
        rc_user_id: rcUserId,
      })
      .select('id')
      .single();
    if (error != null) {
      console.error('[send-app-message] practitioner insert:', error);
    } else {
      approveId = row?.id as string;
    }
  } else if (isAffiliateApply) {
    const {error} = await sb.from('affiliate_applications').insert({
      email: fromEmail,
      message,
      rc_user_id: rcUserId,
      platform: platform || null,
      app_version: appVersion || null,
      status: 'pending',
    });
    if (error != null) {
      console.error('[send-app-message] affiliate_applications insert:', error);
    }
  }

  const {data: inserted, error: insertErr} = await sb
    .from('app_messages')
    .insert({
      to_recipient: toKey,
      subject,
      message,
      category,
      from_email: fromEmail || null,
      rc_user_id: rcUserId,
      platform: platform || null,
      app_version: appVersion || null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertErr != null) {
    console.error('[send-app-message] DB insert error:', insertErr);
    return json({error: 'Could not store message.'}, 500);
  }

  const messageId = inserted?.id as string | undefined;
  const submissionId =
    outreachType === 'beta'
      ? messageId
      : outreachType === 'post'
        ? approveId
        : outreachType === 'practitioner'
          ? approveId
          : undefined;

  let codeBundle: OutreachCodeBundle = {
    primary: null,
    apple: null,
    google: null,
    appleRemaining: 0,
    googleRemaining: 0,
  };
  if (outreachType != null) {
    codeBundle = await allocateOutreachCodes(
      sb,
      outreachType,
      platform,
      submissionId ?? null,
      rcUserId,
    );
  }

  const details = `<h2>${escapeHtml(subject)}</h2>
<p><b>Category:</b> ${escapeHtml(category)}</p>
${fromEmail ? `<p><b>Reply to:</b> <a href="mailto:${escapeHtml(fromEmail)}">${escapeHtml(fromEmail)}</a></p>` : ''}
<p><b>RC User ID:</b> ${escapeHtml(rcUserId ?? '—')}</p>
<p><b>Platform:</b> ${escapeHtml(outreachPlatformLabel(platform))}</p>
<p><b>App version:</b> ${escapeHtml(appVersion || '—')}</p>
<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(message)}</pre>`;

  const html =
    outreachType != null
      ? adminReviewEmailHtml(outreachType, details, codeBundle, platform)
      : details;

  const emailSubject =
    outreachType != null
      ? `${subject} ${outreachSubjectTag(outreachType, codeBundle.primary?.code)}`
      : isAffiliateApply
        ? `[Affiliate Apply] ${subject}`
        : subject;

  const sent = await sendResendEmail({
    to: TO_MAP[toKey],
    subject: emailSubject,
    html,
    replyTo: fromEmail || undefined,
  });

  if (!sent.ok) {
    return json({error: sent.error}, 503);
  }

  return json({
    success: true,
    message:
      outreachType != null
        ? outreachSuccessMessage(platform)
        : 'Message sent. We aim to reply within two business days.',
  });
});

function extractLine(text: string, prefix: string): string | null {
  const line = text.split('\n').find(l => l.startsWith(prefix));
  if (line == null) {
    return null;
  }
  const value = line.slice(prefix.length).trim();
  return value.length > 0 ? value : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
