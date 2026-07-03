/**
 * RevenueCat subscriber attributes (REST v1).
 */

const RC_API_V1 = 'https://api.revenuecat.com/v1';

function resolveSecret(): string {
  return Deno.env.get('RC_SECRET_KEY') ?? '';
}

export async function setRcCustomerAttributes(
  rcAppUserId: string,
  attributes: Record<string, string>,
): Promise<{ok: true} | {ok: false; error: string}> {
  const secret = resolveSecret();
  if (secret.length === 0) {
    return {ok: false, error: 'RC secret not configured.'};
  }

  const payload: Record<string, {value: string}> = {};
  for (const [key, value] of Object.entries(attributes)) {
    payload[key] = {value};
  }

  const customerId = encodeURIComponent(rcAppUserId);
  const res = await fetch(`${RC_API_V1}/subscribers/${customerId}/attributes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({attributes: payload}),
  });

  if (res.status === 200 || res.status === 201) {
    return {ok: true};
  }

  const text = await res.text();
  console.error('[rcAttributes] set failed:', res.status, text);
  return {ok: false, error: 'Could not update subscriber attributes.'};
}
