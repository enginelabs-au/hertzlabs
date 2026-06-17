#!/usr/bin/env node
/**
 * Creates / verifies App Store Connect IAP products to match RevenueCat + iapCatalog.ts.
 * Never prints secret values.
 *
 * Requires in .env:
 *   APPLE_CONNECT_ISSUER_ID
 *   APPLE_CONNECT_API_KEY (App Store Connect API .p8 PEM)
 *   APPLE_CONNECT_SUBSCRIPTION_KEY (In-App Purchase .p8 PEM)
 *   APPLE_CONNECT_KEY_ID (default: LYRCN33Z95)
 *   APPLE_CONNECT_SUBSCRIPTION_KEY_ID (default: 66X9R9YQAN)
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

const BUNDLE_ID = 'com.hertzlabs.binauralbeats';

const CATALOG = {
  subscriptionGroup: {
    referenceName: 'Hertz Labs Premium',
    localization: {locale: 'en-US', name: 'Premium'},
  },
  subscriptions: [
    {
      productId: 'hertzlabs_bb_monthly',
      name: 'Hertz Labs Premium Monthly',
      period: 'ONE_MONTH',
      priceUsd: 4.99,
      trialDays: 7,
      groupLevel: 2,
      description: 'Premium frequencies, AI suggestions, and controls.',
    },
    {
      productId: 'hertzlabs_bb_annual',
      name: 'Hertz Labs Premium Annual',
      period: 'ONE_YEAR',
      priceUsd: 29.99,
      trialDays: 7,
      groupLevel: 1,
      description: 'Premium frequencies, AI suggestions, and controls.',
    },
  ],
  lifetime: {
    productId: 'hertzlabs_lifetime_ultra',
    name: 'Hertz Labs Lifetime Ultra',
    priceUsd: 59.99,
    description: 'One-time purchase for lifetime premium access.',
  },
};

function parseEnv(filePath) {
  const out = {};
  let key = null;
  let buf = [];
  const flush = () => {
    if (!key) return;
    out[key] = buf.join('\n').trim().replace(/^["']|["']$/g, '');
    key = null;
    buf = [];
  };
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!key && (!t || t.startsWith('#'))) continue;
    if (!key) {
      const i = line.indexOf('=');
      if (i < 0) continue;
      key = line.slice(0, i).trim();
      buf = [line.slice(i + 1)];
      if (!buf[0].includes('-----BEGIN')) flush();
      continue;
    }
    buf.push(line);
    if (line.includes('-----END')) flush();
  }
  flush();
  return out;
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function makeJwt({issuer, keyId, pem}) {
  const header = {alg: 'ES256', kid: keyId, typ: 'JWT'};
  const now = Math.floor(Date.now() / 1000);
  const payload = {iss: issuer, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1'};
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sign = crypto.createSign('SHA256');
  sign.update(unsigned);
  sign.end();
  const signature = sign.sign({key: crypto.createPrivateKey(pem), dsaEncoding: 'ieee-p1363'});
  return `${unsigned}.${b64url(signature)}`;
}

async function ascRequest(token, method, route, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = {raw: text};
  }
  return {status: res.status, json};
}

async function ascGetAll(token, route) {
  const items = [];
  let next = `${route}${route.includes('?') ? '&' : '?'}limit=200`;
  while (next) {
    const {status, json} = await ascRequest(token, 'GET', next);
    if (status >= 400) {
      throw new Error(`ASC ${next} failed (${status}): ${JSON.stringify(json)}`);
    }
    items.push(...(json.data ?? []));
    next = json.links?.next ? json.links.next.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  return items;
}

function logOk(msg) {
  console.log(`OK: ${msg}`);
}
function logFix(msg) {
  console.log(`FIXED: ${msg}`);
}
function logWarn(msg) {
  console.log(`WARN: ${msg}`);
}
function logAction(msg) {
  console.log(`ACTION: ${msg}`);
}

async function findPricePoint(token, subscriptionId, targetUsd) {
  const points = await ascGetAll(
    token,
    `/v1/subscriptions/${subscriptionId}/pricePoints?filter[territory]=USA`,
  );
  let best = null;
  let bestDiff = Infinity;
  for (const p of points) {
    const price = Number(p.attributes?.customerPrice ?? NaN);
    if (!Number.isFinite(price)) continue;
    const diff = Math.abs(price - targetUsd);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p;
    }
  }
  if (!best || bestDiff > 0.02) {
    throw new Error(`No USA price point near $${targetUsd} for subscription ${subscriptionId}`);
  }
  return best.id;
}

async function ensureSubscriptionPrice(token, subscriptionId, targetUsd) {
  const existing = await ascGetAll(
    token,
    `/v1/subscriptions/${subscriptionId}/prices?filter[territory]=USA`,
  );
  if (existing.length) {
    logOk(`Price already set for subscription ${subscriptionId}`);
    return;
  }
  const pricePointId = await findPricePoint(token, subscriptionId, targetUsd);
  const {status, json} = await ascRequest(token, 'POST', '/v1/subscriptionPrices', {
    data: {
      type: 'subscriptionPrices',
      relationships: {
        subscription: {data: {type: 'subscriptions', id: subscriptionId}},
        subscriptionPricePoint: {data: {type: 'subscriptionPricePoints', id: pricePointId}},
      },
    },
  });
  if (status >= 300) {
    logWarn(
      `Could not auto-set $${targetUsd} for subscription ${subscriptionId} (${status}) — set price in ASC after metadata is complete`,
    );
    return;
  }
  logFix(`Set subscription ${subscriptionId} price ~$${targetUsd} (price point ${pricePointId})`);
}

async function ensureIntroTrial(token, subscriptionId) {
  const offers = await ascGetAll(token, `/v1/subscriptions/${subscriptionId}/introductoryOffers`);
  const trial = offers.find(o => o.attributes?.offerMode === 'FREE_TRIAL');
  if (trial) {
    logOk(`Intro trial already exists for ${subscriptionId}`);
    return;
  }
  logAction(
    `Add 7-day free trial for ${subscriptionId} in ASC → subscription → Introductory Offers`,
  );
}

async function ensureSubscriptionLocalization(token, subscriptionId, spec) {
  const locs = await ascGetAll(token, `/v1/subscriptions/${subscriptionId}/subscriptionLocalizations`);
  const en = locs.find(l => l.attributes?.locale === 'en-US');
  if (en) {
    logOk(`Localization exists for ${spec.productId}`);
    return;
  }
  const {status, json} = await ascRequest(token, 'POST', '/v1/subscriptionLocalizations', {
    data: {
      type: 'subscriptionLocalizations',
      attributes: {
        name: spec.name,
        description: spec.description,
        locale: 'en-US',
      },
      relationships: {
        subscription: {data: {type: 'subscriptions', id: subscriptionId}},
      },
    },
  });
  if (status >= 300) {
    throw new Error(`subscriptionLocalizations failed (${status}): ${JSON.stringify(json)}`);
  }
  logFix(`Added en-US localization for ${spec.productId}`);
}

async function ensureSubscription(token, groupId, spec) {
  const subs = await ascGetAll(token, `/v1/subscriptionGroups/${groupId}/subscriptions`);
  const existing = subs.find(s => s.attributes?.productId === spec.productId);
  if (existing) {
    logOk(`Subscription exists: ${spec.productId} (${existing.id})`);
    await ensureSubscriptionLocalization(token, existing.id, spec);
    await ensureSubscriptionPrice(token, existing.id, spec.priceUsd);
    await ensureIntroTrial(token, existing.id);
    return existing.id;
  }

  const {status, json} = await ascRequest(token, 'POST', '/v1/subscriptions', {
    data: {
      type: 'subscriptions',
      attributes: {
        name: spec.name,
        productId: spec.productId,
        subscriptionPeriod: spec.period,
        reviewNote: 'Premium unlock for binaural beat frequency ranges and AI features.',
        groupLevel: spec.groupLevel,
        familySharable: false,
      },
      relationships: {
        group: {data: {type: 'subscriptionGroups', id: groupId}},
      },
    },
  });
  if (status === 409) {
    const dup = subs.find(s => s.attributes?.productId === spec.productId);
    if (!dup) {
      throw new Error(
        `Product ID ${spec.productId} is burned or exists outside this group — pick a new ID in iapCatalog.ts`,
      );
    }
    logOk(`Subscription already exists: ${spec.productId} (${dup.id})`);
    await ensureSubscriptionLocalization(token, dup.id, spec);
    await ensureSubscriptionPrice(token, dup.id, spec.priceUsd);
    await ensureIntroTrial(token, dup.id);
    return dup.id;
  }
  if (status >= 300) {
    throw new Error(`create subscription ${spec.productId} failed (${status}): ${JSON.stringify(json)}`);
  }
  const id = json.data.id;
  logFix(`Created subscription ${spec.productId} (${id})`);
  await ensureSubscriptionLocalization(token, id, spec);
  await ensureSubscriptionPrice(token, id, spec.priceUsd);
  await ensureIntroTrial(token, id);
  return id;
}

async function ensureSubscriptionGroup(token, appId) {
  const groups = await ascGetAll(token, `/v1/apps/${appId}/subscriptionGroups`);
  let group = groups.find(g => g.attributes?.referenceName === CATALOG.subscriptionGroup.referenceName);
  if (!group) {
    const {status, json} = await ascRequest(token, 'POST', '/v1/subscriptionGroups', {
      data: {
        type: 'subscriptionGroups',
        attributes: {referenceName: CATALOG.subscriptionGroup.referenceName},
        relationships: {app: {data: {type: 'apps', id: appId}}},
      },
    });
    if (status >= 300) {
      throw new Error(`create subscription group failed (${status}): ${JSON.stringify(json)}`);
    }
    group = json.data;
    logFix(`Created subscription group "${CATALOG.subscriptionGroup.referenceName}" (${group.id})`);
  } else {
    logOk(`Subscription group exists (${group.id})`);
  }

  const locs = await ascGetAll(
    token,
    `/v1/subscriptionGroups/${group.id}/subscriptionGroupLocalizations`,
  );
  if (!locs.some(l => l.attributes?.locale === CATALOG.subscriptionGroup.localization.locale)) {
    const {status, json} = await ascRequest(token, 'POST', '/v1/subscriptionGroupLocalizations', {
      data: {
        type: 'subscriptionGroupLocalizations',
        attributes: CATALOG.subscriptionGroup.localization,
        relationships: {
          subscriptionGroup: {data: {type: 'subscriptionGroups', id: group.id}},
        },
      },
    });
    if (status >= 300) {
      logWarn(`Could not add group localization (${status}) — add manually in ASC`);
    } else {
      logFix('Added subscription group en-US localization');
    }
  } else {
    logOk('Subscription group localization exists');
  }

  return group.id;
}

async function ensureLifetime(token, appId) {
  const iaps = await ascGetAll(token, `/v1/apps/${appId}/inAppPurchasesV2`);
  const existing = iaps.find(i => i.attributes?.productId === CATALOG.lifetime.productId);
  if (existing) {
    logOk(`Lifetime IAP exists: ${CATALOG.lifetime.productId} (${existing.id}, ${existing.attributes?.inAppPurchaseType})`);
    return existing.id;
  }
  const {status, json} = await ascRequest(token, 'POST', '/v2/inAppPurchases', {
    data: {
      type: 'inAppPurchases',
      attributes: {
        name: CATALOG.lifetime.name,
        productId: CATALOG.lifetime.productId,
        inAppPurchaseType: 'NON_CONSUMABLE',
        reviewNote: 'One-time lifetime premium unlock.',
      },
      relationships: {
        app: {data: {type: 'apps', id: appId}},
      },
    },
  });
  if (status >= 300) {
    throw new Error(`create lifetime IAP failed (${status}): ${JSON.stringify(json)}`);
  }
  logFix(`Created lifetime IAP ${CATALOG.lifetime.productId} (${json.data.id})`);
  return json.data.id;
}

async function main() {
  const env = parseEnv(envPath);
  const issuer = (env.APPLE_CONNECT_ISSUER_ID || '').trim();
  const apiKeyId = (env.APPLE_CONNECT_KEY_ID || 'LYRCN33Z95').trim();
  const apiPem = env.APPLE_CONNECT_API_KEY || '';

  if (!issuer) {
    console.error(
      'Missing APPLE_CONNECT_ISSUER_ID in .env\n' +
        'Get it from App Store Connect → Users and Access → Integrations (top of page, UUID format).',
    );
    process.exit(1);
  }
  if (!apiPem.includes('BEGIN PRIVATE KEY')) {
    console.error('Missing valid APPLE_CONNECT_API_KEY PEM in .env');
    process.exit(1);
  }

  const apiToken = makeJwt({issuer, keyId: apiKeyId, pem: apiPem});

  console.log('--- App Store Connect IAP setup ---');

  const apps = await ascGetAll(apiToken, `/v1/apps?filter[bundleId]=${BUNDLE_ID}`);
  const app = apps.find(a => a.attributes?.bundleId === BUNDLE_ID);
  if (!app) {
    throw new Error(`App not found for bundle ${BUNDLE_ID}`);
  }
  logOk(`App ${app.attributes?.name ?? app.id} (${app.id})`);

  const groupId = await ensureSubscriptionGroup(apiToken, app.id);
  for (const spec of CATALOG.subscriptions) {
    await ensureSubscription(apiToken, groupId, spec);
  }
  await ensureLifetime(apiToken, app.id);

  console.log('\n--- Post-setup (manual in App Store Connect) ---');
  logAction('Attach all 3 IAPs to app version 1.0 → In-App Purchases and Subscriptions → +');
  logAction('Confirm Paid Apps Agreement is Active (Agreements, Tax, and Banking)');
  logAction('Wait 15–60 minutes, then open paywall on device and tap Retry');
  logAction('Sandbox test: iPhone Settings → App Store → Sandbox Account');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
