/**
 * RevenueCat REST API v2 — grant promotional Premium access.
 * Uses the V2 secret key (sk_…) already configured in Supabase secrets.
 */

const RC_API_V2 = 'https://api.revenuecat.com/v2';

function resolveProjectId(): string {
  return Deno.env.get('RC_PROJECT_ID') ?? 'projfb12b396';
}

function resolveEntitlementInternalId(): string {
  return Deno.env.get('RC_ENTITLEMENT_INTERNAL_ID') ?? 'entl6f36969bac';
}

function resolveSecret(): string {
  return Deno.env.get('RC_SECRET_KEY') ?? '';
}

/** Grant Premium for a duration in milliseconds from now. */
export async function grantRcPremiumForMs(
  rcAppUserId: string,
  durationMs: number,
): Promise<{ok: true} | {ok: false; error: string; status?: number}> {
  const secret = resolveSecret();
  if (secret.length === 0) {
    return {ok: false, error: 'Server misconfiguration — contact support.', status: 500};
  }

  const projectId = resolveProjectId();
  const entitlementId = resolveEntitlementInternalId();
  const customerId = encodeURIComponent(rcAppUserId);
  const expiresAt = Date.now() + durationMs;

  const customerRes = await fetch(
    `${RC_API_V2}/projects/${projectId}/customers/${customerId}`,
    {headers: {Authorization: `Bearer ${secret}`}},
  );

  if (customerRes.status === 404) {
    return {
      ok: false,
      error: 'Account not ready yet — close and reopen the app, then try again.',
      status: 400,
    };
  }

  if (!customerRes.ok) {
    const errText = await customerRes.text();
    console.error('[rcGrant] customer lookup failed:', customerRes.status, errText);
    return {ok: false, error: 'Could not verify your account — please try again.', status: 502};
  }

  const grantRes = await fetch(
    `${RC_API_V2}/projects/${projectId}/customers/${customerId}/actions/grant_entitlement`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({entitlement_id: entitlementId, expires_at: expiresAt}),
    },
  );

  if (grantRes.status === 409) {
    // Entitlement already active — treat as success for idempotent UX.
    return {ok: true};
  }

  if (!grantRes.ok) {
    const errText = await grantRes.text();
    console.error('[rcGrant] grant failed:', grantRes.status, errText);
    return {ok: false, error: 'Could not activate Premium — please try again.', status: 502};
  }

  return {ok: true};
}

export const RC_GRANT_DURATIONS_MS = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  threeMonth: 90 * 24 * 60 * 60 * 1000,
  lifetime: 100 * 365 * 24 * 60 * 60 * 1000,
} as const;
