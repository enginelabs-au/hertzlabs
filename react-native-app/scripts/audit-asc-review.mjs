#!/usr/bin/env node
/**
 * Audit App Store Connect review status, rejections, IAP health, and builds.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const APP_ID = '6777604364';
const BUNDLE_ID = 'com.hertzlabs.binauralbeats';

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

async function asc(token, method, route, body) {
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

async function ascGetAll(token, route) {
  const rows = [];
  let next = route;
  while (next) {
    const {status, json} = await asc(token, 'GET', next);
    if (status >= 300) {
      throw new Error(`ASC ${status} ${route}: ${JSON.stringify(json)}`);
    }
    rows.push(...(json.data ?? []));
    next = json.links?.next
      ? json.links.next.replace('https://api.appstoreconnect.apple.com', '')
      : null;
  }
  return rows;
}

const env = parseEnv(envPath);
const token = makeJwt({
  issuer: env.APPLE_CONNECT_ISSUER_ID.trim(),
  keyId: env.APPLE_CONNECT_KEY_ID || 'LYRCN33Z95',
  pem: env.APPLE_CONNECT_API_KEY,
});

const issues = [];
const ok = [];

console.log('=== ASC Review Audit ===');
console.log(`App: ${BUNDLE_ID} (${APP_ID})\n`);

const app = await asc(token, 'GET', `/v1/apps/${APP_ID}`);
if (app.status >= 300) {
  console.error('Failed to load app:', app.status, app.text);
  process.exit(1);
}
ok.push(`App loaded: ${app.json?.data?.attributes?.name}`);

const versions = await ascGetAll(token, `/v1/apps/${APP_ID}/appStoreVersions?limit=10`);
for (const v of versions.sort((a, b) => (a.attributes.versionString < b.attributes.versionString ? 1 : -1))) {
  const a = v.attributes;
  console.log(`\n--- Version ${a.versionString} (${v.id}) ---`);
  console.log(`  appStoreState: ${a.appStoreState}`);
  console.log(`  releaseType: ${a.releaseType ?? '—'}`);
  console.log(`  createdDate: ${a.createdDate}`);

  if (['REJECTED', 'METADATA_REJECTED', 'DEVELOPER_REJECTED'].includes(a.appStoreState)) {
    issues.push(`Version ${a.versionString} state is ${a.appStoreState}`);
  }

  const submissions = await ascGetAll(
    token,
    `/v1/appStoreVersions/${v.id}/appStoreVersionSubmissions`,
  );
  for (const sub of submissions) {
    const sa = sub.attributes;
    console.log(`  submission: ${sub.id} state=${sa.state ?? '—'}`);
    if (sa.state === 'REJECTED') {
      issues.push(`Version submission ${sub.id} REJECTED`);
    }
  }

  const reviewSubmissions = await ascGetAll(
    token,
    `/v1/appStoreVersions/${v.id}/reviewSubmissions`,
  );
  for (const rs of reviewSubmissions) {
    const ra = rs.attributes;
    console.log(`  reviewSubmission: ${rs.id} state=${ra.state} submitted=${ra.submittedDate ?? '—'}`);
    if (ra.state === 'REJECTED') {
      issues.push(`Review submission ${rs.id} REJECTED`);
    }

    const items = await ascGetAll(token, `/v1/reviewSubmissions/${rs.id}/items`);
    console.log(`    items: ${items.length}`);
    for (const item of items) {
      console.log(`      - ${item.type} ${item.id} state=${item.attributes?.state ?? '—'}`);
    }
  }

  const builds = await ascGetAll(token, `/v1/appStoreVersions/${v.id}/build`);
  console.log(`  linked builds: ${builds.length}`);
  for (const b of builds) {
    const ba = b.attributes;
    console.log(`    build ${ba.version} (${b.id}) processing=${ba.processingState} expired=${ba.expired}`);
    if (ba.processingState === 'FAILED') {
      issues.push(`Build ${ba.version} processing FAILED`);
    }
  }

  if (builds.length === 0 && ['PREPARE_FOR_SUBMISSION', 'READY_FOR_SALE', 'WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(a.appStoreState)) {
    issues.push(`Version ${a.versionString} has no linked build`);
  }
}

console.log('\n--- IAP / Subscriptions ---');
const iaps = await ascGetAll(token, `/v1/apps/${APP_ID}/inAppPurchasesV2`);
for (const iap of iaps) {
  const ia = iap.attributes;
  console.log(`  IAP ${ia.name} (${ia.productId}) state=${ia.state} review=${ia.inAppPurchaseType}`);
  if (ia.state && !['APPROVED', 'READY_TO_SUBMIT', 'WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(ia.state)) {
    issues.push(`IAP ${ia.productId} state=${ia.state}`);
  }
}

const groups = await ascGetAll(token, `/v1/apps/${APP_ID}/subscriptionGroups`);
for (const g of groups) {
  const subs = await ascGetAll(token, `/v1/subscriptionGroups/${g.id}/subscriptions`);
  for (const s of subs) {
    const sa = s.attributes;
    console.log(`  Sub ${sa.name} (${sa.productId}) state=${sa.state}`);
    if (sa.state && !['APPROVED', 'READY_TO_SUBMIT', 'WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(sa.state)) {
      issues.push(`Subscription ${sa.productId} state=${sa.state}`);
    }
    const locs = await ascGetAll(token, `/v1/subscriptions/${s.id}/subscriptionLocalizations`);
    for (const loc of locs) {
      const la = loc.attributes;
      if (la.state && la.state !== 'APPROVED' && la.state !== 'PREPARE_FOR_SUBMISSION') {
        console.log(`    loc ${la.locale} state=${la.state}`);
        if (['REJECTED', 'DEVELOPER_ACTION_NEEDED'].includes(la.state)) {
          issues.push(`Subscription ${sa.productId} localization ${la.locale} state=${la.state}`);
        }
      }
    }
  }
}

const allBuilds = await ascGetAll(token, `/v1/builds?filter[app]=${APP_ID}&limit=20&sort=-uploadedDate`);
console.log('\n--- Recent builds ---');
for (const b of allBuilds.slice(0, 8)) {
  const ba = b.attributes;
  console.log(`  v${ba.version} uploaded=${ba.uploadedDate} processing=${ba.processingState} expired=${ba.expired}`);
}

console.log('\n=== Summary ===');
if (ok.length) {
  console.log('OK:');
  ok.forEach(line => console.log(`  ✓ ${line}`));
}
if (issues.length) {
  console.log('\nISSUES (fix in ASC or code):');
  issues.forEach(line => console.log(`  ✗ ${line}`));
  process.exitCode = 1;
} else {
  console.log('\nNo blocking ASC issues detected via API.');
}
