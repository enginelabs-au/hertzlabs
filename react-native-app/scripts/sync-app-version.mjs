#!/usr/bin/env node
/**
 * Keeps Android versionCode/versionName and iOS CFBundleVersion/MARKETING_VERSION
 * in sync from react-native-app/app.version.json (canonical store release identity).
 *
 * When the versionCode changes, publishes a force-update policy to Supabase.
 * Blocking is per-client: old builds stay blocked; updated builds never see it.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionPath = path.join(root, 'app.version.json');
const envPath = path.join(root, '.env');
const {versionName, versionCode} = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

if (!versionName || versionCode == null) {
  console.error('sync-app-version: app.version.json needs versionName and versionCode');
  process.exit(1);
}

function parseEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) {
    return out;
  }
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    const i = line.indexOf('=');
    if (i < 0) {
      continue;
    }
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

async function publishForceUpdatePolicy(code) {
  const env = parseEnv(envPath);
  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn(
      'sync-app-version: skip Supabase force-update publish (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env)',
    );
    return;
  }

  const now = new Date().toISOString();
  for (const platform of ['ios', 'android']) {
    const res = await fetch(`${supabaseUrl}/rest/v1/app_update_policy?platform=eq.${platform}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        latest_version_code: code,
        min_version_code: code,
        force_update: true,
        updated_at: now,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`sync-app-version: force-update publish failed for ${platform} (${res.status}): ${text}`);
    } else {
      console.log(
        `sync-app-version: Supabase force-update ON for ${platform} (builds below ${code} blocked until they update)`,
      );
    }
  }
}

const gradlePath = path.join(root, 'android/app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
const prevVersionCodeMatch = gradle.match(/versionCode\s+(\d+)/);
const prevVersionCode = prevVersionCodeMatch ? Number.parseInt(prevVersionCodeMatch[1], 10) : null;

const nextGradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);

const gradleChanged = nextGradle !== gradle;
if (gradleChanged) {
  fs.writeFileSync(gradlePath, nextGradle);
  console.log(`sync-app-version: android/app/build.gradle → ${versionName} (${versionCode})`);
} else {
  console.log(`sync-app-version: android already ${versionName} (${versionCode})`);
}

const pbxPath = path.join(root, 'ios/HertzLabsBinauralBeats.xcodeproj/project.pbxproj');
let pbx = fs.readFileSync(pbxPath, 'utf8');
const nextPbx = pbx
  .replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${versionCode};`)
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${versionName};`);

const pbxChanged = nextPbx !== pbx;
if (pbxChanged) {
  fs.writeFileSync(pbxPath, nextPbx);
  console.log(`sync-app-version: ios project → ${versionName} (${versionCode})`);
} else {
  console.log(`sync-app-version: ios already ${versionName} (${versionCode})`);
}

const versionBumped = prevVersionCode != null && prevVersionCode !== versionCode;
if (versionBumped && process.env.SKIP_FORCE_UPDATE_PUBLISH !== '1') {
  await publishForceUpdatePolicy(versionCode);
} else if (versionBumped) {
  console.log(
    'sync-app-version: skip Supabase force-update publish (SKIP_FORCE_UPDATE_PUBLISH=1)',
  );
}
