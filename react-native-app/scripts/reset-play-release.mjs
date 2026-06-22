#!/usr/bin/env node
/**
 * Upload a fresh AAB and replace track releases with a single completed release.
 * Halts any in-progress/draft releases on the target tracks first.
 *
 * Usage:
 *   node scripts/reset-play-release.mjs [path/to/app-release.aab]
 *   PLAY_TRACKS=internal,alpha,production node scripts/reset-play-release.mjs
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';
import {getGoogleAccessToken, loadServiceAccount, playApiRequest} from './lib/google-play-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, '..');
const envPath = path.join(appRoot, '.env');
const env = parseEnv(envPath);

const PACKAGE = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? 'com.hertzlabs.binauralbeats';
const TRACKS = (process.env.PLAY_TRACKS ?? 'internal,alpha,production')
  .split(',')
  .map(t => t.trim())
  .filter(Boolean);
const DEFAULT_AAB = path.join(
  appRoot,
  'android/app/build/outputs/bundle/release/app-release.aab',
);
const AAB_PATH = path.resolve(appRoot, process.argv[2] ?? DEFAULT_AAB);
const versionJson = JSON.parse(
  fs.readFileSync(path.join(appRoot, 'app.version.json'), 'utf8'),
);
const RELEASE_NAME = process.env.PLAY_RELEASE_NAME ?? versionJson.versionName ?? 'release';
const RELEASE_NOTES =
  process.env.PLAY_RELEASE_NOTES ??
  'Store-native promo redemption and bug fixes.';

const credRel = (
  env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH ||
  '.secrets/speedy-crawler-499309-s7-7d911ab4f0e8.json'
).trim();
const credPath = path.isAbsolute(credRel) ? credRel : path.join(appRoot, credRel);

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UPLOAD_BASE = `https://www.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;

async function uploadBundle(token, editId, aabPath) {
  const res = await fetch(`${UPLOAD_BASE}/edits/${editId}/bundles?uploadType=media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: fs.readFileSync(aabPath),
  });
  const json = await res.json().catch(() => ({}));
  return {status: res.status, json};
}

function haltExistingReleases(trackJson) {
  const halted = [];
  for (const release of trackJson?.releases ?? []) {
    if (release.status === 'inProgress' || release.status === 'draft') {
      halted.push({
        ...release,
        status: 'halted',
      });
    }
  }
  return halted;
}

async function main() {
  if (!fs.existsSync(AAB_PATH)) {
    console.error(`AAB not found: ${AAB_PATH}`);
    process.exit(1);
  }

  const token = await getGoogleAccessToken(loadServiceAccount(credPath));
  console.log(`Package: ${PACKAGE}`);
  console.log(`AAB: ${AAB_PATH}`);
  console.log(`Tracks: ${TRACKS.join(', ')}`);

  const editRes = await playApiRequest(token, 'POST', `${BASE}/edits`, {});
  if (editRes.status >= 300) {
    console.error('Failed to create edit:', editRes.status, editRes.json);
    process.exit(1);
  }
  const editId = editRes.json?.id;
  console.log(`Edit id: ${editId}`);

  const upload = await uploadBundle(token, editId, AAB_PATH);
  if (upload.status >= 300) {
    console.error('Bundle upload failed:', upload.status, upload.json);
    process.exit(1);
  }
  const versionCode = upload.json?.versionCode;
  console.log(`Uploaded bundle versionCode=${versionCode}`);

  const newRelease = {
    name: RELEASE_NAME,
    status: 'completed',
    versionCodes: [versionCode],
    releaseNotes: [{language: 'en-US', text: RELEASE_NOTES}],
  };

  let allOk = true;
  for (const track of TRACKS) {
    const current = await playApiRequest(token, 'GET', `${BASE}/edits/${editId}/tracks/${track}`);
    const halted = haltExistingReleases(current.json);
    const releases = [...halted, newRelease];
    const trackRes = await playApiRequest(token, 'PUT', `${BASE}/edits/${editId}/tracks/${track}`, {
      track,
      releases,
    });
    console.log(
      `track ${track}:`,
      trackRes.status,
      trackRes.status >= 300 ? JSON.stringify(trackRes.json) : `OK (versionCode ${versionCode})`,
    );
    if (trackRes.status >= 300) {
      allOk = false;
    }
  }

  if (!allOk) {
    console.error('One or more tracks failed — aborting commit.');
    await playApiRequest(token, 'DELETE', `${BASE}/edits/${editId}`);
    process.exit(1);
  }

  const commitRes = await playApiRequest(token, 'POST', `${BASE}/edits/${editId}:commit`, {});
  if (commitRes.status >= 300) {
    console.error('Commit failed:', commitRes.status, commitRes.json);
    process.exit(1);
  }
  console.log(`OK: committed edit ${commitRes.json?.id ?? ''} with versionCode ${versionCode}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
