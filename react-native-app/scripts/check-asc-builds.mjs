#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
const APP_ID = '6777604364';

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

const env = parseEnv(envPath);
const token = makeJwt({
  issuer: env.APPLE_CONNECT_ISSUER_ID.trim(),
  keyId: env.APPLE_CONNECT_KEY_ID || 'LYRCN33Z95',
  pem: env.APPLE_CONNECT_API_KEY,
});

async function get(route) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${route}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
  return res.json();
}

const versions = await get(`/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
for (const v of versions.data ?? []) {
  const a = v.attributes;
  console.log(`Version ${a.versionString}: ${a.appStoreState} (${v.id})`);
}

console.log('\nRecent builds:');
const builds = await get(`/v1/builds?filter[app]=${APP_ID}&limit=8&sort=-uploadedDate`);
for (const b of builds.data ?? []) {
  const a = b.attributes;
  console.log(`  v${a.version} processing=${a.processingState} uploaded=${a.uploadedDate}`);
}

const rs = await get(`/v1/reviewSubmissions?filter[app]=${APP_ID}&limit=5&sort=-submittedDate`);
for (const r of rs.data ?? []) {
  const a = r.attributes;
  console.log(`\nReviewSubmission ${r.id}: state=${a.state} submitted=${a.submittedDate ?? '—'}`);
}
