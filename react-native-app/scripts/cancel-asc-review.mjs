#!/usr/bin/env node
/**
 * Cancel the active App Store review submission (pull from review).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
const SUBMISSION_ID = process.env.ASC_SUBMISSION_ID ?? 'ee97cb14-791b-41fa-a4ab-f808e74283b6';

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

console.log(`--- Cancel review submission ${SUBMISSION_ID} ---`);

const before = await asc('GET', `/v1/reviewSubmissions/${SUBMISSION_ID}`);
const state = before.json?.data?.attributes?.state;
console.log(`Before: state=${state}`);

if (state === 'COMPLETE' || state === 'CANCELING') {
  console.log('Nothing to cancel.');
  process.exit(0);
}

const {status, json} = await asc('PATCH', `/v1/reviewSubmissions/${SUBMISSION_ID}`, {
  data: {
    type: 'reviewSubmissions',
    id: SUBMISSION_ID,
    attributes: {canceled: true},
  },
});

if (status >= 300) {
  console.error('Cancel failed:', status, JSON.stringify(json, null, 2));
  process.exit(1);
}

const afterState = json?.data?.attributes?.state;
console.log(`OK: canceled submission — state=${afterState}`);
