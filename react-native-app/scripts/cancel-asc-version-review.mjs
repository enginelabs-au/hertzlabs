#!/usr/bin/env node
/**
 * Cancel active App Store review submissions for version 1.0.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
const VERSION_ID = process.env.ASC_VERSION_ID ?? '2bfc2fc7-31fc-44bd-8b3c-7a329172b40a';

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

const env = parseEnv(envPath);
const token = makeJwt({
  issuer: env.APPLE_CONNECT_ISSUER_ID.trim(),
  keyId: env.APPLE_CONNECT_KEY_ID || 'LYRCN33Z95',
  pem: env.APPLE_CONNECT_API_KEY,
});

const list = await asc(token, 'GET', `/v1/appStoreVersions/${VERSION_ID}/reviewSubmissions`);
if (list.status >= 300) {
  console.error('Failed to list review submissions:', list.status, list.text);
  process.exit(1);
}

const submissions = list.json?.data ?? [];
console.log(`Found ${submissions.length} review submission(s) for version ${VERSION_ID}`);

let canceled = 0;
for (const sub of submissions) {
  const state = sub.attributes?.state;
  console.log(`  ${sub.id}: state=${state}`);
  if (['COMPLETE', 'CANCELING', 'CANCELED'].includes(state)) {
    continue;
  }
  const {status, json} = await asc(token, 'PATCH', `/v1/reviewSubmissions/${sub.id}`, {
    data: {
      type: 'reviewSubmissions',
      id: sub.id,
      attributes: {canceled: true},
    },
  });
  if (status >= 300) {
    console.error(`  Cancel failed for ${sub.id}:`, status, JSON.stringify(json));
    process.exit(1);
  }
  console.log(`  OK: canceled ${sub.id} → state=${json?.data?.attributes?.state}`);
  canceled++;
}

if (canceled === 0) {
  console.log('No active review submissions to cancel.');
} else {
  console.log(`Canceled ${canceled} submission(s).`);
}
