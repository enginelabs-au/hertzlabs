/**
 * Hertz Labs — submit-form edge function
 *
 * POST /functions/v1/submit-form
 * Body: { type: 'post' | 'practitioner', ...fields }
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {adminReviewEmailHtml} from '../_shared/approveLink.ts';
import {outreachSubjectTag, userShareCodeNoteHtml} from '../_shared/outreachPromo.ts';
import {escapeHtml, sendResendEmail} from '../_shared/resend.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REVIEW_EMAIL = 'hello@enginelabs.com.au';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  const type = body.type as string | undefined;
  if (type !== 'post' && type !== 'practitioner') {
    return json({error: 'Invalid submission type.'}, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (type === 'post') {
    const {post_url, platform, description, rc_user_id, referral_code} = body as Record<string, string>;
    if (!post_url || post_url.trim().length < 5) {
      return json({error: 'Post URL is required.'}, 400);
    }
    const rcId = String(rc_user_id ?? '').trim();
    if (rcId.length === 0) {
      return json({
        error: 'Could not link your account. Fully close the app, reopen, wait a few seconds, then submit again.',
      }, 400);
    }
    const {data: inserted, error} = await sb.from('post_submissions').insert({
      post_url: post_url.trim(),
      platform: platform?.trim() ?? null,
      description: description?.trim() ?? null,
      rc_user_id: rcId,
      referral_code: referral_code ?? null,
    }).select('id').single();
    if (error != null) {
      console.error('[submit-form] DB insert error:', error);
      return json({error: 'Failed to store submission.'}, 500);
    }

    const postId = inserted?.id as string | undefined;
    const details = `<h2>New "Make a Post" Submission</h2>
       <p><b>Post URL:</b> <a href="${escapeHtml(post_url)}">${escapeHtml(post_url)}</a></p>
       <p><b>Platform:</b> ${escapeHtml(platform ?? '—')}</p>
       <p><b>Description:</b> ${escapeHtml(description ?? '—')}</p>
       <p><b>RC User ID:</b> ${escapeHtml(rc_user_id ?? 'anonymous')}</p>
       ${userShareCodeNoteHtml(referral_code)}
       <p style="color:#888">Review in <a href="https://supabase.com/dashboard/project/mvawkzhwgtlwxwkssvyg/editor">Supabase → post_submissions</a></p>`;

    await sendEmail(
      `📸 New Post Submission — Hertz Labs ${outreachSubjectTag('post')}`,
      postId != null ? adminReviewEmailHtml('post', details, postId) : adminReviewEmailHtml('post', details),
    );

    return json({success: true, message: 'Submission received. We\'ll review it within 48 hours.'});
  }

  const {full_name, credentials, practice, website, email, rc_user_id, referral_code} = body as Record<
    string,
    string
  >;
  if (!full_name?.trim() || !email?.trim()) {
    return json({error: 'Name and email are required.'}, 400);
  }
  const rcId = String(rc_user_id ?? '').trim();
  if (rcId.length === 0) {
    return json({
      error: 'Could not link your account. Fully close the app, reopen, wait a few seconds, then submit again.',
    }, 400);
  }
  const {data: inserted, error} = await sb.from('practitioner_applications').insert({
    full_name: full_name.trim(),
    credentials: credentials?.trim() ?? null,
    practice: practice?.trim() ?? null,
    website: website?.trim() ?? null,
    email: email.trim(),
    rc_user_id: rcId,
  }).select('id').single();
  if (error != null) {
    console.error('[submit-form] DB insert error:', error);
    return json({error: 'Failed to store application.'}, 500);
  }

  const practId = inserted?.id as string | undefined;
  const details = `<h2>New Practitioner / Therapist Application</h2>
     <p><b>Name:</b> ${escapeHtml(full_name)}</p>
     <p><b>Credentials / Role:</b> ${escapeHtml(credentials ?? '—')}</p>
     <p><b>Practice / Organisation:</b> ${escapeHtml(practice ?? '—')}</p>
     <p><b>Website:</b> ${website ? `<a href="${escapeHtml(website)}">${escapeHtml(website)}</a>` : '—'}</p>
     <p><b>Email:</b> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
     <p><b>RC User ID:</b> ${escapeHtml(rc_user_id ?? 'anonymous')}</p>
     ${userShareCodeNoteHtml(referral_code)}
     <p style="color:#888">Review in <a href="https://supabase.com/dashboard/project/mvawkzhwgtlwxwkssvyg/editor">Supabase → practitioner_applications</a></p>`;

  await sendEmail(
    `🩺 New Practitioner Application — Hertz Labs ${outreachSubjectTag('practitioner')}`,
    practId != null ? adminReviewEmailHtml('practitioner', details, practId) : adminReviewEmailHtml('practitioner', details),
  );

  return json({success: true, message: 'Application received. We\'ll be in touch within 3 business days.'});
});

async function sendEmail(subject: string, html: string): Promise<void> {
  const sent = await sendResendEmail({to: REVIEW_EMAIL, subject, html});
  if (!sent.ok) {
    console.error('[submit-form]', sent.error);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
