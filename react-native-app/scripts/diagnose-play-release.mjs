#!/usr/bin/env node
/**
 * Print Google Play release diagnostics (tracks, bundles, country availability).
 */
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';
import {getGoogleAccessToken, loadServiceAccount, playApiRequest} from './lib/google-play-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, '..');
const env = parseEnv(path.join(appRoot, '.env'));
const credRel = (
  env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH ||
  '.secrets/speedy-crawler-499309-s7-7d911ab4f0e8.json'
).trim();
const credPath = path.isAbsolute(credRel) ? credRel : path.join(appRoot, credRel);
const PACKAGE = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? 'com.hertzlabs.binauralbeats';
const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;

const sa = loadServiceAccount(credPath);
const token = await getGoogleAccessToken(sa);
const edit = await playApiRequest(token, 'POST', `${BASE}/edits`, {});
const editId = edit.json?.id;

const tracks = await playApiRequest(token, 'GET', `${BASE}/edits/${editId}/tracks`);
const bundles = await playApiRequest(token, 'GET', `${BASE}/edits/${editId}/bundles`);

console.log(`Package: ${PACKAGE}`);
console.log(`Uploaded bundles (versionCodes): ${(bundles.json?.bundles ?? []).map(b => b.versionCode).sort((a, b) => a - b).join(', ') || 'none'}`);
console.log('');

for (const track of tracks.json?.tracks ?? []) {
  console.log(`=== ${track.track} ===`);
  const releases = track.releases ?? [];
  if (releases.length === 0) {
    console.log('  (no releases)');
  } else {
    for (const r of releases) {
      console.log(`  ${r.status}: versionCodes=[${r.versionCodes?.join(', ')}] name="${r.name ?? ''}"`);
    }
  }
  const countries = await playApiRequest(token, 'GET', `${BASE}/edits/${editId}/countryAvailability/${track.track}`);
  const count = countries.json?.countries?.length ?? 0;
  const rest = countries.json?.restOfWorld ? ' + restOfWorld' : '';
  if (countries.status === 204 || count === 0) {
    if (track.track === 'production') {
      console.log('  countries: *** NONE — production rollout blocked until set in Console ***');
      console.log('           → Test and release → Production → Countries / regions');
      console.log('           → Setup → Advanced settings → App availability → Published');
    } else {
      console.log('  countries: NONE configured');
    }
  } else {
    console.log(`  countries: ${count}${rest}`);
  }
  console.log('');
}

await playApiRequest(token, 'DELETE', `${BASE}/edits/${editId}`);

console.log('Common Console errors:');
console.log('- "does not add or remove any app bundles" → draft release has no bundle in "New app bundles" (Add from library).');
console.log('- "doesn\'t allow existing users to upgrade" → versionCode not higher than live track, or production countries unset.');
console.log('- Duplicate draft + completed on same track/version → Discard the draft release.');
