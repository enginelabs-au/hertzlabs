import {sendAppMessage} from '../services/sendAppMessage';

export async function sendPromoPostFallback(fields: {
  postUrl: string;
  platform: string;
  description: string;
  email: string;
}): Promise<{ok: boolean; message: string}> {
  return sendAppMessage({
    to: 'hello',
    subject: 'Hertz Labs — Make a Post submission',
    category: 'promo_post',
    fromEmail: fields.email,
    message: [
      'Make a Post submission (fallback)',
      '',
      `Post URL: ${fields.postUrl}`,
      `Platform: ${fields.platform || '—'}`,
      `Applicant email: ${fields.email}`,
      '',
      fields.description || '(no description)',
    ].join('\n'),
  });
}

export async function sendPractitionerFallback(fields: {
  fullName: string;
  credentials: string;
  practice: string;
  website: string;
  email: string;
}): Promise<{ok: boolean; message: string}> {
  return sendAppMessage({
    to: 'hello',
    subject: 'Hertz Labs — Practitioner application',
    category: 'promo_practitioner',
    fromEmail: fields.email,
    message: [
      'Practitioner / therapist application (fallback)',
      '',
      `Name: ${fields.fullName}`,
      `Credentials / role: ${fields.credentials || '—'}`,
      `Practice / organisation: ${fields.practice || '—'}`,
      `Website: ${fields.website || '—'}`,
      `Applicant email: ${fields.email}`,
    ].join('\n'),
  });
}
