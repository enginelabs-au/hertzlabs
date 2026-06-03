#!/usr/bin/env node
/**
 * Syncs GEMINI_API_KEY from `.env` into gitignored GenerativeAI-Info.plist files (xor-v1).
 * Never logs key values.
 */
const fs = require('fs');
const path = require('path');

const appRoot = path.join(__dirname, '..');
const repoRoot = path.join(appRoot, '..');
const envPath = path.join(appRoot, '.env');

const PLIST_TARGETS = [
  path.join(appRoot, 'ios/HertzLabsBinauralBeats/GenerativeAI-Info.plist'),
  path.join(repoRoot, 'swift-app/Config/GenerativeAI-Info.plist'),
  path.join(repoRoot, 'swift-app/Profiling/GenerativeAI-Info.plist'),
];

function parseEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function xorEncodeV1(plain) {
  return Buffer.from(plain, 'utf8')
    .map(b => (b ^ 0xab).toString(16).padStart(2, '0'))
    .join('');
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writeGenerativeAiPlist(targetPath, encodedKey) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>API_KEY</key>
\t<string>${escapeXml(encodedKey)}</string>
\t<key>API_KEY_SCHEME</key>
\t<string>xor-v1</string>
</dict>
</plist>
`;
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
  fs.writeFileSync(targetPath, xml);
}

const env = parseEnv(envPath);
const gemini = (env.GEMINI_API_KEY || '').trim();

if (!gemini) {
  console.log('sync-native-secrets: no GEMINI_API_KEY in .env');
  process.exit(0);
}

const encoded = xorEncodeV1(gemini);
for (const target of PLIST_TARGETS) {
  writeGenerativeAiPlist(target, encoded);
}

console.log(
  `sync-native-secrets: updated ${PLIST_TARGETS.length} GenerativeAI-Info.plist file(s) (keys not printed)`,
);
