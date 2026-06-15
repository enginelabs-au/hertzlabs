#!/usr/bin/env node
/**
 * Writes gitignored secret files under .secrets/ from react-native-app/.env.
 * Validates PEM/JSON shape and optionally probes ASC + Play APIs. Never prints secrets.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';
import {getGoogleAccessToken, loadServiceAccount} from './lib/google-play-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, '..');
const envPath = path.join(appRoot, '.env');
const secretsDir = path.join(appRoot, '.secrets');
const defaultPlayJson = '.secrets/speedy-crawler-499309-s7-7d911ab4f0e8.json';

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function makeAscJwt({issuer, keyId, pem}) {
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

function validatePem(pem, label) {
  if (!pem || !pem.includes('BEGIN PRIVATE KEY')) {
    throw new Error(`${label}: missing or invalid PEM (expected -----BEGIN PRIVATE KEY-----)`);
  }
  crypto.createPrivateKey(pem);
}

function writeP8(prefix, keyId, pem) {
  if (!keyId) {
    throw new Error('Missing Key ID for .p8 export');
  }
  const fileName = `${prefix}_${keyId}.p8`;
  validatePem(pem, fileName);
  const filePath = path.join(secretsDir, fileName);
  fs.mkdirSync(secretsDir, {recursive: true});
  const normalized = `${pem.trim()}\n`;
  fs.writeFileSync(filePath, normalized, {mode: 0o600});
  fs.chmodSync(filePath, 0o600);
  return filePath;
}

async function probeAsc(pem, keyId, issuer) {
  const token = makeAscJwt({issuer, keyId, pem});
  const res = await fetch('https://api.appstoreconnect.apple.com/v1/apps?limit=1', {
    headers: {Authorization: `Bearer ${token}`},
  });
  if (res.status === 401 || res.status === 403) {
    return {ok: false, detail: `HTTP ${res.status} (check Key ID, Issuer ID, or key role in ASC)`};
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return {ok: false, detail: `HTTP ${res.status} ${body.slice(0, 120)}`};
  }
  return {ok: true, detail: 'App Store Connect API reachable'};
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env at react-native-app/.env');
    process.exit(1);
  }

  const env = parseEnv(envPath);
  const issuer = (env.APPLE_CONNECT_ISSUER_ID || '').trim();
  const apiKeyId = (env.APPLE_CONNECT_KEY_ID || '').trim();
  const subKeyId = (env.APPLE_CONNECT_SUBSCRIPTION_KEY_ID || '').trim();
  const apiPem = env.APPLE_CONNECT_API_KEY || '';
  const subPem = env.APPLE_CONNECT_SUBSCRIPTION_KEY || '';
  const playJsonRel =
    (env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH || defaultPlayJson).trim();
  const playJsonPath = path.isAbsolute(playJsonRel) ? playJsonRel : path.join(appRoot, playJsonRel);

  console.log('--- sync-secrets-files ---');

  const written = [];

  if (apiPem && apiKeyId) {
    const p = writeP8('AuthKey', apiKeyId, apiPem);
    written.push(path.relative(appRoot, p));
    console.log(`OK: wrote ${path.basename(p)}`);
  } else {
    console.log('SKIP: APPLE_CONNECT_API_KEY or APPLE_CONNECT_KEY_ID missing');
  }

  if (subPem && subKeyId) {
    const p = writeP8('SubscriptionKey', subKeyId, subPem);
    written.push(path.relative(appRoot, p));
    console.log(`OK: wrote ${path.basename(p)}`);
    // Remove legacy misnamed export if present (RC rejects AuthKey_* for subscription slot).
    const stale = path.join(secretsDir, `AuthKey_${subKeyId}.p8`);
    if (fs.existsSync(stale)) {
      fs.unlinkSync(stale);
      console.log(`OK: removed stale ${path.basename(stale)}`);
    }
  } else {
    console.log('SKIP: APPLE_CONNECT_SUBSCRIPTION_KEY or APPLE_CONNECT_SUBSCRIPTION_KEY_ID missing');
  }

  if (fs.existsSync(playJsonPath)) {
    try {
      loadServiceAccount(playJsonPath);
      console.log(`OK: Play service account JSON present (${path.relative(appRoot, playJsonPath)})`);
    } catch {
      console.log(`ISSUE: Play JSON at ${path.relative(appRoot, playJsonPath)} is not valid JSON`);
    }
  } else {
    console.log(`ISSUE: missing ${playJsonRel}`);
  }

  // Format checks (no values printed)
  const checks = [
    ['REVENUECAT_API_KEY_IOS', env.REVENUECAT_API_KEY_IOS, v => v?.startsWith('appl_')],
    ['REVENUECAT_API_KEY_ANDROID', env.REVENUECAT_API_KEY_ANDROID, v => v?.startsWith('goog_')],
    ['REVENUECAT_API_KEY_WEB', env.REVENUECAT_API_KEY_WEB, v => v?.startsWith('sk_')],
    ['APPLE_CONNECT_ISSUER_ID', issuer, v => /^[0-9a-f-]{36}$/i.test(v || '')],
    ['GEMINI_API_KEY', env.GEMINI_API_KEY, v => (v || '').length > 10],
  ];
  for (const [name, val, okFn] of checks) {
    console.log(okFn(val?.trim()) ? `OK: ${name} format` : `ISSUE: ${name} missing or wrong format`);
  }

  if (apiPem && apiKeyId && issuer) {
    const asc = await probeAsc(apiPem, apiKeyId, issuer);
    console.log(asc.ok ? `OK: ${asc.detail}` : `ISSUE: ASC API — ${asc.detail}`);
  }

  if (subPem && subKeyId) {
    validatePem(subPem, 'subscription key');
    console.log('OK: subscription .p8 PEM parses as EC private key');
  }

  if (fs.existsSync(playJsonPath)) {
    try {
      const sa = loadServiceAccount(playJsonPath);
      await getGoogleAccessToken(sa);
      console.log('OK: Google service account OAuth token acquired');
    } catch (e) {
      console.log(`ISSUE: Google OAuth — ${e.message}`);
    }
  }

  console.log(`\nWrote ${written.length} .p8 file(s) under .secrets/ (gitignored).`);
  console.log(
    'Manual: RevenueCat iOS app → upload AuthKey_<API_KEY_ID>.p8 (App Store Connect API) and SubscriptionKey_<SUB_KEY_ID>.p8 (In-App Purchase) plus Issuer ID.',
  );
  console.log(`Manual: upload ${path.basename(playJsonPath)} in RevenueCat → Android app → Service credentials.`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
