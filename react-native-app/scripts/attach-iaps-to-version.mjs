#!/usr/bin/env node
/**
 * Submit IAPs/subscriptions for App Store review when stuck in DEVELOPER_ACTION_NEEDED.
 * Creates subscriptionSubmissions / inAppPurchaseSubmissions (the API path that works).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
const APP_ID = '6777604364';
const VERSION_ID = '2bfc2fc7-31fc-44bd-8b3c-7a329172b40a';
const GROUP_ID = '22147327';
const PRODUCT_IDS = {
  monthly: 'hertzlabs_bb_monthly',
  annual: 'hertzlabs_bb_annual',
  lifetime: 'hertzlabs_lifetime_ultra',
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

async function asc(method, route, body) {
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
  return {status: res.status, json, text};
}

async function ascGetAll(route) {
  const items = [];
  let next = `${route}${route.includes('?') ? '&' : '?'}limit=200`;
  while (next) {
    const {status, json} = await asc('GET', next);
    if (status >= 400) {
      throw new Error(`ASC ${next} failed (${status}): ${JSON.stringify(json)}`);
    }
    items.push(...(json.data ?? []));
    next = json.links?.next ? json.links.next.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  return items;
}

const env = parseEnv(envPath);
const token = makeJwt({
  issuer: env.APPLE_CONNECT_ISSUER_ID.trim(),
  keyId: env.APPLE_CONNECT_KEY_ID.trim(),
  pem: env.APPLE_CONNECT_API_KEY,
});

const NEEDS_SUBMIT = new Set(['DEVELOPER_ACTION_NEEDED', 'READY_TO_SUBMIT', 'MISSING_METADATA']);

async function submitSubscription(subscriptionId, productId, state) {
  if (!NEEDS_SUBMIT.has(state) && state !== 'WAITING_FOR_REVIEW') {
    console.log(`SKIP: ${productId} state=${state}`);
    return;
  }
  if (state === 'WAITING_FOR_REVIEW') {
    console.log(`OK: ${productId} already WAITING_FOR_REVIEW`);
    return;
  }
  const {status, json} = await asc('POST', '/v1/subscriptionSubmissions', {
    data: {
      type: 'subscriptionSubmissions',
      relationships: {
        subscription: {data: {type: 'subscriptions', id: subscriptionId}},
      },
    },
  });
  if (status === 201) {
    console.log(`FIXED: ${productId} submitted for review (${json?.data?.id})`);
    return;
  }
  console.log(
    `WARN: ${productId} subscriptionSubmissions (${status}) ${json?.errors?.[0]?.detail ?? ''}`,
  );
}

async function submitLifetime(iapId, productId, state) {
  if (!NEEDS_SUBMIT.has(state) && state !== 'WAITING_FOR_REVIEW') {
    console.log(`SKIP: ${productId} state=${state}`);
    return;
  }
  if (state === 'WAITING_FOR_REVIEW') {
    console.log(`OK: ${productId} already WAITING_FOR_REVIEW`);
    return;
  }
  const {status, json} = await asc('POST', '/v1/inAppPurchaseSubmissions', {
    data: {
      type: 'inAppPurchaseSubmissions',
      relationships: {
        inAppPurchaseV2: {data: {type: 'inAppPurchases', id: iapId}},
      },
    },
  });
  if (status === 201) {
    console.log(`FIXED: ${productId} submitted for review (${json?.data?.id})`);
    return;
  }
  console.log(
    `WARN: ${productId} inAppPurchaseSubmissions (${status}) ${json?.errors?.[0]?.detail ?? ''}`,
  );
}

async function main() {
  console.log('--- Submit IAPs for App Store review ---');

  const version = await asc('GET', `/v1/appStoreVersions/${VERSION_ID}`);
  console.log(
    `Version ${version.json?.data?.attributes?.versionString} state=${version.json?.data?.attributes?.appStoreState}`,
  );

  const subs = await ascGetAll(`/v1/subscriptionGroups/${GROUP_ID}/subscriptions`);
  for (const sub of subs) {
    const productId = sub.attributes?.productId;
    const state = sub.attributes?.state;
    if (productId === PRODUCT_IDS.monthly || productId === PRODUCT_IDS.annual) {
      await submitSubscription(sub.id, productId, state);
      const refreshed = await asc('GET', `/v1/subscriptions/${sub.id}`);
      console.log(`  → ${productId} now ${refreshed.json?.data?.attributes?.state ?? 'unknown'}`);
    }
  }

  const iaps = await ascGetAll(`/v1/apps/${APP_ID}/inAppPurchasesV2`);
  const lifetime = iaps.find(i => i.attributes?.productId === PRODUCT_IDS.lifetime);
  if (lifetime) {
    await submitLifetime(lifetime.id, PRODUCT_IDS.lifetime, lifetime.attributes?.state);
    const refreshed = await asc('GET', `/v2/inAppPurchases/${lifetime.id}`);
    console.log(
      `  → ${PRODUCT_IDS.lifetime} now ${refreshed.json?.data?.attributes?.state ?? 'unknown'}`,
    );
  } else {
    console.log(`WARN: lifetime IAP ${PRODUCT_IDS.lifetime} not found`);
  }

  console.log('\nRevenueCat “Developer action needed” clears after ASC products leave DEVELOPER_ACTION_NEEDED (often → WAITING_FOR_REVIEW).');
  console.log('RC may take 15–60 min to refresh; live StoreKit prices appear after Apple approves the IAPs.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
