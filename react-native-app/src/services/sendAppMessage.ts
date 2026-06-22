import {APP_VERSION} from '../constants/appInfo';
import {SUPABASE_FUNCTION_HEADERS} from '../monetization/supabaseAnon';
import {getOutreachPlatform} from '../promos/outreachPlatform';
import {getRcAppUserId} from '../promos/getRcAppUserId';

const SEND_MESSAGE_URL =
  'https://mvawkzhwgtlwxwkssvyg.supabase.co/functions/v1/send-app-message';

export type AppMessageRecipient = 'hello' | 'support';

export type SendAppMessageInput = {
  to: AppMessageRecipient;
  subject: string;
  message: string;
  category: string;
  fromEmail?: string;
};

export async function sendAppMessage(
  input: SendAppMessageInput,
): Promise<{ok: boolean; message: string}> {
  const rcUserId = await getRcAppUserId();
  try {
    const res = await fetch(SEND_MESSAGE_URL, {
      method: 'POST',
      headers: SUPABASE_FUNCTION_HEADERS,
      body: JSON.stringify({
        to: input.to,
        subject: input.subject,
        message: input.message,
        category: input.category,
        from_email: input.fromEmail?.trim() || undefined,
        platform: getOutreachPlatform(),
        app_version: APP_VERSION,
        rc_user_id: rcUserId ?? undefined,
      }),
    });
    const data = (await res.json()) as {
      success?: boolean;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      return {ok: false, message: data.error ?? 'Could not send message.'};
    }
    return {ok: true, message: data.message ?? 'Message sent.'};
  } catch {
    return {ok: false, message: 'Could not reach server. Check your connection.'};
  }
}
