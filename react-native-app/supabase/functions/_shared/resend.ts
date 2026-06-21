const DEFAULT_FROM =
  Deno.env.get('RESEND_FROM_EMAIL') ?? 'Hertz Labs <noreply@enginelabs.com.au>';

export async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ok: true} | {ok: false; error: string}> {
  const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY not set');
    return {ok: false, error: 'Email service is not configured.'};
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: DEFAULT_FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? {reply_to: opts.replyTo} : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[resend] API error:', res.status, err);
      return {ok: false, error: 'Failed to send message. Please try again.'};
    }
    return {ok: true};
  } catch (e) {
    console.error('[resend] send failed:', e);
    return {ok: false, error: 'Failed to send message. Please try again.'};
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
