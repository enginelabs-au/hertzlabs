#!/usr/bin/env node
/**
 * Link a processed ASC build to an app store version and submit for review.
 *
 * Usage:
 *   node scripts/submit-asc-version-review.mjs --platform IOS --version 2.3 --build 23
 *   node scripts/submit-asc-version-review.mjs --platform MAC_OS --version 2.3 --build 23
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const APP_ID = '6777604364';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--platform') out.platform = argv[++i];
    else if (arg === '--version') out.versionString = argv[++i];
    else if (arg === '--build') out.buildNumber = argv[++i];
  }
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
  let next = route.includes('?') ? route : `${route}?limit=200`;
  while (next) {
    const {status, json} = await asc(token, 'GET', next);
    if (status >= 300) {
      throw new Error(`ASC GET ${next} failed (${status}): ${JSON.stringify(json)}`);
    }
    rows.push(...(json.data ?? []));
    next = json.links?.next
      ? json.links.next.replace('https://api.appstoreconnect.apple.com', '')
      : null;
  }
  return rows;
}

function platformForBuild(attrs) {
  const iconUrl = attrs?.iconAssetToken?.templateUrl ?? '';
  if (iconUrl.includes('.icns')) {
    return 'MAC_OS';
  }
  return 'IOS';
}

async function waitForValidBuild(token, buildNumber, platform, maxAttempts = 60) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const builds = await ascGetAll(
      token,
      `/v1/builds?filter[app]=${APP_ID}&filter[version]=${encodeURIComponent(buildNumber)}&sort=-uploadedDate`,
    );
    const match = builds.find(
      b =>
        String(b.attributes?.version) === String(buildNumber) &&
        platformForBuild(b.attributes) === platform,
    );
    if (match) {
      const state = match.attributes?.processingState;
      console.log(`Build ${buildNumber} (${platform}): processingState=${state} id=${match.id}`);
      if (state === 'VALID') return match;
      if (state === 'FAILED' || state === 'INVALID') {
        throw new Error(`Build ${buildNumber} ${platform} is ${state}`);
      }
    } else {
      console.log(`Attempt ${attempt}/${maxAttempts}: build ${buildNumber} (${platform}) not found yet`);
    }
    await new Promise(r => setTimeout(r, 30_000));
  }
  throw new Error(`Timed out waiting for VALID build ${buildNumber} (${platform})`);
}

async function findOrCreateVersion(token, versionString, platform) {
  const versions = await ascGetAll(token, `/v1/apps/${APP_ID}/appStoreVersions`);
  const existing = versions.find(
    v => v.attributes?.versionString === versionString && v.attributes?.platform === platform,
  );
  if (existing) {
    console.log(`Using existing version ${versionString} (${platform}): ${existing.id} state=${existing.attributes?.appStoreState}`);
    return existing;
  }
  const {status, json} = await asc(token, 'POST', '/v1/appStoreVersions', {
    data: {
      type: 'appStoreVersions',
      attributes: {platform, versionString},
      relationships: {app: {data: {type: 'apps', id: APP_ID}}},
    },
  });
  if (status >= 300) {
    throw new Error(`Create version failed (${status}): ${JSON.stringify(json)}`);
  }
  console.log(`Created version ${versionString} (${platform}): ${json.data.id}`);
  return json.data;
}

async function linkBuildToVersion(token, versionId, buildId) {
  const {status, json} = await asc(token, 'PATCH', `/v1/appStoreVersions/${versionId}/relationships/build`, {
    data: {type: 'builds', id: buildId},
  });
  if (status >= 300) {
    throw new Error(`Link build failed (${status}): ${JSON.stringify(json)}`);
  }
  console.log(`Linked build ${buildId} to version ${versionId}`);
}

async function submitVersionForReview(token, versionId, platform) {
  const open = await ascGetAll(
    token,
    `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=${platform}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW`,
  );
  for (const sub of open) {
    const state = sub.attributes?.state;
    if (['WAITING_FOR_REVIEW', 'IN_REVIEW', 'UNRESOLVED'].includes(state)) {
      console.log(`Review submission already active for ${platform}: ${sub.id} state=${state}`);
      return sub;
    }
  }

  const create = await asc(token, 'POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      relationships: {app: {data: {type: 'apps', id: APP_ID}}},
    },
  });
  if (create.status >= 300) {
    throw new Error(`Create review submission failed (${create.status}): ${JSON.stringify(create.json)}`);
  }
  const submissionId = create.json.data.id;
  console.log(`Created review submission ${submissionId}`);

  const item = await asc(token, 'POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: {data: {type: 'reviewSubmissions', id: submissionId}},
        appStoreVersion: {data: {type: 'appStoreVersions', id: versionId}},
      },
    },
  });
  if (item.status >= 300) {
    throw new Error(`Add review item failed (${item.status}): ${JSON.stringify(item.json)}`);
  }
  console.log(`Added version ${versionId} to submission ${submissionId}`);

  const submit = await asc(token, 'PATCH', `/v1/reviewSubmissions/${submissionId}`, {
    data: {
      type: 'reviewSubmissions',
      id: submissionId,
      attributes: {submitted: true},
    },
  });
  if (submit.status >= 300) {
    throw new Error(`submitForReview failed (${submit.status}): ${JSON.stringify(submit.json)}`);
  }
  console.log(
    `Submitted ${platform} version for review: submission=${submissionId} state=${submit.json?.data?.attributes?.state ?? '—'}`,
  );
  return submit.json?.data ?? create.json.data;
}

async function main() {
  const {platform, versionString, buildNumber} = parseArgs(process.argv);
  if (!platform || !versionString || !buildNumber) {
    console.error('Usage: node scripts/submit-asc-version-review.mjs --platform IOS|MAC_OS --version 2.3 --build 23');
    process.exit(1);
  }

  const env = parseEnv(envPath);
  const keyId = (env.APPLE_CONNECT_KEY_ID || 'S6FZD2L3R5').trim();
  const issuer = (env.APPLE_CONNECT_ISSUER_ID || '').trim();
  const keyPath = path.join(__dirname, '..', '.secrets', `AuthKey_${keyId}.p8`);
  if (!issuer || !fs.existsSync(keyPath)) {
    console.error('Missing APPLE_CONNECT_ISSUER_ID or .secrets/AuthKey_*.p8');
    process.exit(1);
  }
  const pem = fs.readFileSync(keyPath, 'utf8');
  const token = makeJwt({
    issuer,
    keyId,
    pem,
  });

  console.log(`=== Submit ASC review: ${platform} v${versionString} build ${buildNumber} ===`);
  const build = await waitForValidBuild(token, buildNumber, platform);
  const version = await findOrCreateVersion(token, versionString, platform);
  await linkBuildToVersion(token, version.id, build.id);
  await asc(token, 'PATCH', `/v1/builds/${build.id}`, {
    data: {type: 'builds', id: build.id, attributes: {usesNonExemptEncryption: false}},
  });
  await submitVersionForReview(token, version.id, platform);
  console.log('OK');
}

main().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});
