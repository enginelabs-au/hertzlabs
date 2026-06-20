/**
 * RevenueCat REST API v2 — grant promotional Premium access.
 * Uses the V2 secret key (sk_…) configured in Supabase secrets.
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rcRequest(
  secret: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{status: number; text: string}> {
  const res = await fetch(`${RC_API_V2}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return {status: res.status, text: await res.text()};
}

/** Wait for the SDK-created RC customer record (anonymous IDs cannot be created via API). */
async function ensureRcCustomer(
  projectId: string,
  customerId: string,
  secret: string,
): Promise<{ok: true} | {ok: false; error: string; status?: number}> {
  const path = `/projects/${projectId}/customers/${customerId}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const {status} = await rcRequest(secret, 'GET', path);
    if (status === 200) {
      return {ok: true};
    }
    if (status === 404 && attempt < 4) {
      await sleep(800 * (attempt + 1));
      continue;
    }
    if (status === 404) {
      return {
        ok: false,
        error:
          'Account not ready yet — fully close the app, reopen, wait a few seconds, then tap Activate again.',
        status: 400,
      };
    }
    return {ok: false, error: 'Could not verify your account — please try again.', status: 502};
  }
  return {ok: false, error: 'Could not verify your account — please try again.', status: 502};
}

async function readPremiumExpiryMs(
  projectId: string,
  customerId: string,
  entitlementId: string,
  secret: string,
): Promise<number | null> {
  const path =
    `/projects/${projectId}/customers/${customerId}/active_entitlements`;
  const {status, text} = await rcRequest(secret, 'GET', path);
  if (status !== 200) {
    return null;
  }
  try {
    const json = JSON.parse(text) as {
      items?: Array<{entitlement_id?: string; expires_at?: number | null}>;
    };
    const match = json.items?.find(item => item.entitlement_id === entitlementId);
    if (match?.expires_at == null) {
      return null;
    }
    return match.expires_at;
  } catch {
    return null;
  }
}

/**
 * Grant Premium for `durationMs`, extending any existing Premium expiry by that amount.
 * Free users receive 7 days from activation; existing Premium users get +7 days.
 */
export async function grantRcPremiumForMs(
  rcAppUserId: string,
  durationMs: number,
): Promise<{ok: true; expiresAtMs: number} | {ok: false; error: string; status?: number}> {
  const secret = resolveSecret();
  if (secret.length === 0) {
    return {ok: false, error: 'Server misconfiguration — contact support.', status: 500};
  }

  const projectId = resolveProjectId();
  const entitlementId = resolveEntitlementInternalId();
  const customerId = encodeURIComponent(rcAppUserId);

  const ready = await ensureRcCustomer(projectId, customerId, secret);
  if (!ready.ok) {
    return ready;
  }

  const currentExpiryMs = await readPremiumExpiryMs(
    projectId,
    customerId,
    entitlementId,
    secret,
  );
  const baseMs = Math.max(Date.now(), currentExpiryMs ?? 0);
  const expiresAtMs = baseMs + durationMs;

  const grantPath =
    `/projects/${projectId}/customers/${customerId}/actions/grant_entitlement`;
  let grant = await rcRequest(secret, 'POST', grantPath, {
    entitlement_id: entitlementId,
    expires_at: expiresAtMs,
  });

  if (grant.status === 409) {
    const revokePath =
      `/projects/${projectId}/customers/${customerId}/actions/revoke_granted_entitlement`;
    await rcRequest(secret, 'POST', revokePath, {entitlement_id: entitlementId});
    grant = await rcRequest(secret, 'POST', grantPath, {
      entitlement_id: entitlementId,
      expires_at: expiresAtMs,
    });
    if (grant.status === 409) {
      // Paid store subscription — cannot stack a promotional grant; user keeps Premium.
      return {ok: true, expiresAtMs: currentExpiryMs ?? expiresAtMs};
    }
  }

  if (grant.status !== 201 && grant.status !== 200) {
    console.error('[rcGrant] grant failed:', grant.status, grant.text);
    return {ok: false, error: 'Could not activate Premium — please try again.', status: 502};
  }

  return {ok: true, expiresAtMs};
}

export const RC_GRANT_DURATIONS_MS = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  threeMonth: 90 * 24 * 60 * 60 * 1000,
  lifetime: 100 * 365 * 24 * 60 * 60 * 1000,
} as const;
