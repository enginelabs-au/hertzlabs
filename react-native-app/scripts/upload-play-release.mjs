#!/usr/bin/env node
/**
 * Upload a signed release AAB to Google Play (default: internal track).
 *
 * Usage:
 *   node scripts/upload-play-release.mjs [path/to/app-release.aab]
 *   PLAY_TRACK=production node scripts/upload-play-release.mjs
 *   PLAY_VERSION_CODE=24 PLAY_ASSIGN_ONLY=1 PLAY_TRACK=production node scripts/upload-play-release.mjs
 *
 * Env:
 *   PLAY_TRACK — internal | alpha | beta | production (default: internal)
 *   PLAY_RELEASE_NAME — release label (default: from app.version.json versionName)
 *   PLAY_RELEASE_NOTES — en-US release notes text
 *   PLAY_ASSIGN_ONLY=1 — skip upload; assign an existing bundle versionCode to the track
 *   PLAY_VERSION_CODE — versionCode when PLAY_ASSIGN_ONLY=1
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';
import {
  getGoogleAccessToken,
  loadServiceAccount,
  playApiRequest,
} from './lib/google-play-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, '..');
const envPath = path.join(appRoot, '.env');

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? 'com.hertzlabs.binauralbeats';
const TRACK = process.env.PLAY_TRACK ?? 'internal';
const ASSIGN_ONLY = process.env.PLAY_ASSIGN_ONLY === '1';
const ASSIGN_VERSION_CODE = process.env.PLAY_VERSION_CODE
  ? Number(process.env.PLAY_VERSION_CODE)
  : null;
const versionJson = JSON.parse(
  fs.readFileSync(path.join(appRoot, 'app.version.json'), 'utf8'),
);
const RELEASE_NAME = process.env.PLAY_RELEASE_NAME ?? versionJson.versionName ?? 'release';
const RELEASE_NOTES =
  process.env.PLAY_RELEASE_NOTES ??
  'Store-native promo redemption and bug fixes.';
const DEFAULT_AAB = path.join(
  appRoot,
  'android/app/build/outputs/bundle/release/app-release.aab',
);
const AAB_PATH = path.resolve(appRoot, process.argv[2] ?? DEFAULT_AAB);

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;
const UPLOAD_BASE = `https://www.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE_NAME}`;

function resolveCredentialsPath(env) {
  const rel = (
    env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH ||
    '.secrets/speedy-crawler-499309-s7-7d911ab4f0e8.json'
  ).trim();
  return path.isAbsolute(rel) ? rel : path.join(appRoot, rel);
}

async function uploadBundle(token, editId, aabPath) {
  const url = `${UPLOAD_BASE}/edits/${editId}/bundles?uploadType=media`;
  const body = fs.readFileSync(aabPath);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15 * 60 * 1000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = {raw: text};
    }
    return {status: res.status, json};
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!ASSIGN_ONLY && !fs.existsSync(AAB_PATH)) {
    console.error(`AAB not found: ${AAB_PATH}`);
    process.exit(1);
  }

  const env = parseEnv(envPath);
  const credPath = resolveCredentialsPath(env);
  const serviceAccount = loadServiceAccount(credPath);
  const token = await getGoogleAccessToken(serviceAccount);

  console.log(`Package: ${PACKAGE_NAME}, track: ${TRACK}`);
  if (ASSIGN_ONLY) {
    console.log(`Assign-only mode, versionCode=${ASSIGN_VERSION_CODE}`);
  } else {
    console.log(`Uploading ${AAB_PATH}`);
  }

  const editRes = await playApiRequest(token, 'POST', `${BASE}/edits`, {});
  if (editRes.status >= 300) {
    console.error('Failed to create edit:', editRes.status, editRes.json);
    process.exit(1);
  }
  const editId = editRes.json?.id;
  if (!editId) {
    console.error('No edit id returned:', editRes.json);
    process.exit(1);
  }
  console.log(`Edit id: ${editId}`);

  let versionCode = ASSIGN_VERSION_CODE;
  if (ASSIGN_ONLY) {
    if (!Number.isInteger(versionCode) || versionCode <= 0) {
      console.error('PLAY_ASSIGN_ONLY requires PLAY_VERSION_CODE (positive integer).');
      process.exit(1);
    }
  } else {
    const upload = await uploadBundle(token, editId, AAB_PATH);
    if (upload.status >= 300) {
      console.error('Bundle upload failed:', upload.status, upload.json);
      process.exit(1);
    }
    versionCode = upload.json?.versionCode;
    console.log(`Uploaded bundle versionCode=${versionCode}`);
  }

  const trackRes = await playApiRequest(token, 'PUT', `${BASE}/edits/${editId}/tracks/${TRACK}`, {
    track: TRACK,
    releases: [
      {
        name: RELEASE_NAME,
        status: 'completed',
        versionCodes: [versionCode],
        releaseNotes: [{language: 'en-US', text: RELEASE_NOTES}],
      },
    ],
  });
  if (trackRes.status >= 300) {
    console.error('Track update failed:', trackRes.status, trackRes.json);
    process.exit(1);
  }
  console.log(`Assigned versionCode ${versionCode} to track "${TRACK}"`);

  const commitRes = await playApiRequest(token, 'POST', `${BASE}/edits/${editId}:commit`, {});
  if (commitRes.status >= 300) {
    console.error('Commit failed:', commitRes.status, commitRes.json);
    process.exit(1);
  }
  console.log('OK: Play release committed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
