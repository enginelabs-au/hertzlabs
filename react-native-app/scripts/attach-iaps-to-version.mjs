#!/usr/bin/env node
/**
 * Attach IAPs/subscriptions to app version 1.0 for App Store review.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
const APP_ID = '6777604364';
const VERSION_ID = '2bfc2fc7-31fc-44bd-8b3c-7a329172b40a';
const SUBMISSION_ID = 'ee97cb14-791b-41fa-a4ab-f808e74283b6';
const PRODUCTS = {
  lifetime: '6777615569',
  monthly: '6778755902',
  annual: '6778755165',
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

const env = parseEnv(envPath);
const token = makeJwt({
  issuer: env.APPLE_CONNECT_ISSUER_ID.trim(),
  keyId: env.APPLE_CONNECT_KEY_ID || 'LYRCN33Z95',
  pem: env.APPLE_CONNECT_API_KEY,
});

console.log('--- Attach IAPs to version 1.0 ---');

const version = await asc('GET', `/v1/appStoreVersions/${VERSION_ID}`);
console.log(
  `Version ${version.json?.data?.attributes?.versionString} state=${version.json?.data?.attributes?.appStoreState}`,
);

const items = await asc('GET', `/v1/reviewSubmissions/${SUBMISSION_ID}/items`);
console.log(`Review submission items: ${items.json?.data?.length ?? 0}`);
for (const item of items.json?.data ?? []) {
  const rels = Object.entries(item.relationships ?? {})
    .filter(([, v]) => v?.data?.id)
    .map(([k, v]) => `${k}=${v.data.id}`);
  console.log(`  item ${item.id}: ${rels.join(', ') || '(no linked artifact)'}`);
}

async function tryPost(label, body) {
  const {status, json} = await asc('POST', '/v1/reviewSubmissionItems', body);
  if (status < 300) {
    console.log(`OK: ${label} attached (${json?.data?.id})`);
    return true;
  }
  console.log(
    `FAIL: ${label} (${status}) ${json?.errors?.[0]?.code ?? ''} — ${json?.errors?.[0]?.detail ?? ''}`,
  );
  return false;
}

// Lifetime non-consumable via inAppPurchases relationship
await tryPost('lifetime (inAppPurchases)', {
  data: {
    type: 'reviewSubmissionItems',
    relationships: {
      reviewSubmission: {data: {type: 'reviewSubmissions', id: SUBMISSION_ID}},
      inAppPurchases: {data: {type: 'inAppPurchases', id: PRODUCTS.lifetime}},
    },
  },
});

// Subscriptions — try inAppPurchases type (some ASC versions accept sub IDs here)
for (const [label, id] of [
  ['monthly subscription', PRODUCTS.monthly],
  ['annual subscription', PRODUCTS.annual],
]) {
  await tryPost(`${label} (inAppPurchases)`, {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: {data: {type: 'reviewSubmissions', id: SUBMISSION_ID}},
        inAppPurchases: {data: {type: 'inAppPurchases', id}},
      },
    },
  });
}

// Alternate: inAppPurchaseSubmissions for lifetime
const iapSub = await asc('POST', '/v1/inAppPurchaseSubmissions', {
  data: {
    type: 'inAppPurchaseSubmissions',
    relationships: {
      inAppPurchaseV2: {data: {type: 'inAppPurchases', id: PRODUCTS.lifetime}},
    },
  },
});
console.log(
  `inAppPurchaseSubmissions lifetime: ${iapSub.status} ${iapSub.json?.errors?.[0]?.detail ?? iapSub.json?.data?.id ?? 'ok'}`,
);

// Alternate: subscriptionSubmissions
for (const [label, id] of [
  ['monthly', PRODUCTS.monthly],
  ['annual', PRODUCTS.annual],
]) {
  const sub = await asc('POST', '/v1/subscriptionSubmissions', {
    data: {
      type: 'subscriptionSubmissions',
      relationships: {
        subscription: {data: {type: 'subscriptions', id}},
      },
    },
  });
  console.log(
    `subscriptionSubmissions ${label}: ${sub.status} ${sub.json?.errors?.[0]?.detail ?? sub.json?.data?.id ?? 'ok'}`,
  );
}

const itemsAfter = await asc('GET', `/v1/reviewSubmissions/${SUBMISSION_ID}/items`);
console.log(`\nAfter: ${itemsAfter.json?.data?.length ?? 0} review submission items`);
