/**
 * Hertz Labs — submit-form edge function
 *
 * POST /functions/v1/submit-form
 * Body: { type: 'post' | 'practitioner', ...fields }
 *
 * Stores the submission in Supabase and emails hello@enginelabs.com.au via Resend.
 * Requires RESEND_API_KEY secret (set via: supabase secrets set RESEND_API_KEY=re_xxxx)
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

const REVIEW_EMAIL = 'hello@enginelabs.com.au';
const FROM_EMAIL = 'Hertz Labs <noreply@hertzlabs.app>';

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
    const {error} = await sb.from('post_submissions').insert({
      post_url: post_url.trim(),
      platform: platform?.trim() ?? null,
      description: description?.trim() ?? null,
      rc_user_id: rc_user_id ?? null,
      referral_code: referral_code ?? null,
    });
    if (error != null) {
      console.error('[submit-form] DB insert error:', error);
      return json({error: 'Failed to store submission.'}, 500);
    }

    await sendEmail(
      `📸 New Post Submission — Hertz Labs`,
      `<h2>New "Make a Post" Submission</h2>
       <p><b>Post URL:</b> <a href="${post_url}">${post_url}</a></p>
       <p><b>Platform:</b> ${platform ?? '—'}</p>
       <p><b>Description:</b> ${description ?? '—'}</p>
       <p><b>RC User ID:</b> ${rc_user_id ?? 'anonymous'}</p>
       <p><b>Referral Code:</b> ${referral_code ?? '—'}</p>
       <hr>
       <p style="color:#888">Review in <a href="https://supabase.com/dashboard/project/mvawkzhwgtlwxwkssvyg/editor">Supabase → post_submissions</a></p>`,
    );

    return json({success: true, message: 'Submission received. We\'ll review it within 48 hours.'});
  }

  // type === 'practitioner'
  const {full_name, credentials, practice, website, email, rc_user_id} = body as Record<string, string>;
  if (!full_name?.trim() || !email?.trim()) {
    return json({error: 'Name and email are required.'}, 400);
  }
  const {error} = await sb.from('practitioner_applications').insert({
    full_name: full_name.trim(),
    credentials: credentials?.trim() ?? null,
    practice: practice?.trim() ?? null,
    website: website?.trim() ?? null,
    email: email.trim(),
    rc_user_id: rc_user_id ?? null,
  });
  if (error != null) {
    console.error('[submit-form] DB insert error:', error);
    return json({error: 'Failed to store application.'}, 500);
  }

  await sendEmail(
    `🩺 New Practitioner Application — Hertz Labs`,
    `<h2>New Practitioner / Therapist Application</h2>
     <p><b>Name:</b> ${full_name}</p>
     <p><b>Credentials / Role:</b> ${credentials ?? '—'}</p>
     <p><b>Practice / Organisation:</b> ${practice ?? '—'}</p>
     <p><b>Website:</b> ${website ? `<a href="${website}">${website}</a>` : '—'}</p>
     <p><b>Email:</b> <a href="mailto:${email}">${email}</a></p>
     <p><b>RC User ID:</b> ${rc_user_id ?? 'anonymous'}</p>
     <hr>
     <p style="color:#888">Review in <a href="https://supabase.com/dashboard/project/mvawkzhwgtlwxwkssvyg/editor">Supabase → practitioner_applications</a></p>`,
  );

  return json({success: true, message: 'Application received. We\'ll be in touch within 3 business days.'});
});

async function sendEmail(subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[submit-form] RESEND_API_KEY not set — skipping email notification');
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({from: FROM_EMAIL, to: REVIEW_EMAIL, subject, html}),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[submit-form] Resend error:', res.status, err);
    }
  } catch (e) {
    console.error('[submit-form] Email send failed:', e);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
