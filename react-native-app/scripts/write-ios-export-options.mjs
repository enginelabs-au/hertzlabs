#!/usr/bin/env node
/**
 * Writes ExportOptions plist for iOS App Store upload via API key.
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';

const outPath = process.argv[2];
if (!outPath) {
  console.error('Usage: write-ios-export-options.mjs <output.plist>');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = parseEnv(path.join(root, '.env'));
const keyId = (env.APPLE_CONNECT_KEY_ID || 'S6FZD2L3R5').trim();
const issuer = (env.APPLE_CONNECT_ISSUER_ID || '').trim();
const keyPath = path.join(root, '.secrets', `AuthKey_${keyId}.p8`);

if (!issuer || !fs.existsSync(keyPath)) {
  console.error('Missing APPLE_CONNECT_ISSUER_ID or .secrets/AuthKey_*.p8');
  process.exit(1);
}

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>destination</key>
	<string>upload</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>teamID</key>
	<string>256U2M55W7</string>
	<key>uploadSymbols</key>
	<true/>
	<key>authenticationKeyPath</key>
	<string>${keyPath}</string>
	<key>authenticationKeyID</key>
	<string>${keyId}</string>
	<key>authenticationKeyIssuerID</key>
	<string>${issuer}</string>
</dict>
</plist>
`;

fs.mkdirSync(path.dirname(outPath), {recursive: true});
fs.writeFileSync(outPath, plist);
console.log(`Wrote ${path.relative(root, outPath)}`);
