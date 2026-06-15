#!/usr/bin/env node
/**
 * Keeps Android versionCode/versionName and iOS CFBundleVersion/MARKETING_VERSION
 * in sync from react-native-app/app.version.json (canonical store release identity).
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionPath = path.join(root, 'app.version.json');
const {versionName, versionCode} = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

if (!versionName || versionCode == null) {
  console.error('sync-app-version: app.version.json needs versionName and versionCode');
  process.exit(1);
}

const gradlePath = path.join(root, 'android/app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
const nextGradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);

if (nextGradle !== gradle) {
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

if (nextPbx !== pbx) {
  fs.writeFileSync(pbxPath, nextPbx);
  console.log(`sync-app-version: ios project → ${versionName} (${versionCode})`);
} else {
  console.log(`sync-app-version: ios already ${versionName} (${versionCode})`);
}
