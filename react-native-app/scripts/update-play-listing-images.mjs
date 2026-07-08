#!/usr/bin/env node
/**
 * Replace Google Play store listing screenshots (en-US).
 *
 * Usage:
 *   node scripts/update-play-listing-images.mjs
 *   PLAY_SCREENSHOT_DIR=assets/appstore-screenshots node scripts/update-play-listing-images.mjs
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';
import {getGoogleAccessToken, loadServiceAccount, playApiRequest} from './lib/google-play-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, '..');
const env = parseEnv(path.join(appRoot, '.env'));

const PACKAGE = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? 'com.hertzlabs.binauralbeats';
const LANGUAGE = process.env.PLAY_LISTING_LANGUAGE ?? 'en-US';
const SCREENSHOT_DIR = path.resolve(
  appRoot,
  process.env.PLAY_SCREENSHOT_DIR ?? 'assets/appstore-screenshots',
);

const PRIORITY_FIRST = [
  'cognitive_frequencies_left_hemisphere.jpg',
  'target_brainwave_sync_dual_hemisphere.jpg',
  'music_integration_right_hemisphere.jpg',
];

const PHONE_MAX = 8;

const credRel = (
  env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH ||
  '.secrets/speedy-crawler-499309-s7-7d911ab4f0e8.json'
).trim();
const credPath = path.isAbsolute(credRel) ? credRel : path.join(appRoot, credRel);

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UPLOAD_BASE = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;

function orderedScreenshotPaths(dir) {
  const all = fs
    .readdirSync(dir)
    .filter(f => /\.(jpe?g|png)$/i.test(f) && !f.startsWith('.'))
    .sort();

  const priority = PRIORITY_FIRST.map(name => path.join(dir, name));
  for (const p of priority) {
    if (!fs.existsSync(p)) {
      throw new Error(`Missing priority screenshot: ${p}`);
    }
  }

  const rest = all
    .filter(name => !PRIORITY_FIRST.includes(name))
    .map(name => path.join(dir, name));

  return [...priority, ...rest];
}

async function deleteAllImages(token, editId, imageType) {
  const res = await playApiRequest(
    token,
    'DELETE',
    `${BASE}/edits/${editId}/listings/${LANGUAGE}/${imageType}`,
  );
  if (res.status >= 300 && res.status !== 404) {
    throw new Error(`deleteall ${imageType} failed (${res.status}): ${JSON.stringify(res.json)}`);
  }
}

async function uploadImage(token, editId, imageType, filePath) {
  const res = await fetch(
    `${UPLOAD_BASE}/edits/${editId}/listings/${LANGUAGE}/${imageType}?uploadType=media`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/jpeg',
      },
      body: fs.readFileSync(filePath),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `upload ${path.basename(filePath)} → ${imageType} failed (${res.status}): ${JSON.stringify(json)}`,
    );
  }
  return json?.image?.id;
}

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    console.error(`Screenshot dir not found: ${SCREENSHOT_DIR}`);
    process.exit(1);
  }

  const files = orderedScreenshotPaths(SCREENSHOT_DIR);
  const phoneFiles = files.slice(0, PHONE_MAX);
  const tabletFiles = files.slice(PHONE_MAX);

  console.log(`Package: ${PACKAGE}`);
  console.log(`Language: ${LANGUAGE}`);
  console.log(`Phone screenshots (${phoneFiles.length}):`);
  for (const f of phoneFiles) console.log(`  - ${path.basename(f)}`);
  if (tabletFiles.length) {
    console.log(`7-inch tablet overflow (${tabletFiles.length}):`);
    for (const f of tabletFiles) console.log(`  - ${path.basename(f)}`);
  }

  const token = await getGoogleAccessToken(loadServiceAccount(credPath));
  const editRes = await playApiRequest(token, 'POST', `${BASE}/edits`, {});
  if (editRes.status >= 300) {
    throw new Error(`create edit failed: ${JSON.stringify(editRes.json)}`);
  }
  const editId = editRes.json.id;
  console.log(`Edit id: ${editId}`);

  for (const imageType of ['phoneScreenshots', 'sevenInchScreenshots', 'tenInchScreenshots']) {
    await deleteAllImages(token, editId, imageType);
    console.log(`Cleared ${imageType}`);
  }

  for (const filePath of phoneFiles) {
    const id = await uploadImage(token, editId, 'phoneScreenshots', filePath);
    console.log(`Uploaded phone: ${path.basename(filePath)} (${id})`);
  }

  for (const filePath of tabletFiles) {
    const id = await uploadImage(token, editId, 'sevenInchScreenshots', filePath);
    console.log(`Uploaded 7-inch: ${path.basename(filePath)} (${id})`);
  }

  const commitRes = await playApiRequest(token, 'POST', `${BASE}/edits/${editId}:commit`, {});
  if (commitRes.status >= 300) {
    throw new Error(`commit failed (${commitRes.status}): ${JSON.stringify(commitRes.json)}`);
  }
  console.log(`OK: listing images committed (edit ${commitRes.json?.id ?? editId})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
