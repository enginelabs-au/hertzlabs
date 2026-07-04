#!/usr/bin/env node
/**
 * What's New + App Review notes for Hertz Labs v3.0 (iOS + macOS).
 *
 * Usage: node scripts/update-asc-v30-release.mjs
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const APP_ID = '6777604364';
const VERSION_STRING = '3.0';

export const WHATS_NEW_V30 = `What's New in 3.0

• 30-Day Focus Challenge — daily guided sessions with breathing, ambient texture, and a short reflection. Complete 30 consecutive calendar days to earn one month of Premium.

• Refer a Friend — share your personal HZ code from Promos; friends enter it on Plans for App Store offer rewards.

• Breathing upgrades — box, 4-7-8, resonant, energising, and alternate-nostril patterns with animated guides. Protocol sequences can switch breathing automatically each step.

• Guided depth — relaxation presets with slow entrainment and permissive guided copy for unwinding.

• ASMR ambience — optional rain, room tone, and texture layers during sessions.

• Visual entrainment — optional beat-synced strobe above the oscilloscope (off by default; photosensitivity warnings).

• Streak rewards — tier milestones, streak shields, local daily reminders, and restore offers when you miss a day or return after a break.

• Cancellation winback — optional Premium offer when you manage a subscription cancellation.

• Become an affiliate — apply from Feedback if you create wellness content.

• Stability improvements across iPhone, iPad, and Mac.`;

const IOS_REVIEW_NOTES = `App Review Notes — Hertz Labs v3.0 (iOS)

Thank you for reviewing build 30.

NEW IN v3.0 (wellness / entertainment — not medical treatment):
• 30-Day Focus Challenge (Promos): daily in-app session + questionnaire; one calendar day per step; reward via official App Store Offer Code after Day 30.
• Refer a Friend: manual HZ referrer ID on Plans (separate from store offer code field); rewards are App Store Offer Codes only — no custom IAP bypass.
• Optional photic strobe synced to beat frequency above the oscilloscope — disabled by default; epilepsy/photosensitivity warnings in Safety onboarding and first-enable alert.
• Guided depth presets, ASMR ambience layers, expanded breathing patterns.
• Local streak reminders (Notifee) — user permission required; no remote marketing push in this build.
• Cancellation winback modal before opening subscription management; optional store offer code via existing pool.
• Affiliate interest form on Feedback (email to hello@ — manual approval, no in-app payouts).

Premium remains StoreKit IAP + official App Store Offer Codes only (Promos → Redeem → native Apple redemption). Updated Terms/Privacy on our website cover photic strobe, guided depth, focus challenge, and affiliate applications.

How to verify:
• Promos → 30-Day Focus Challenge (start briefing, session timer at top of app while playing).
• Plans → referral code field (HZ…) separate from promo offer redemption.
• Hub → enable Visual entrainment above oscilloscope (consent alert).
• Settings/notifications: streak reminders opt-in.

Contact: info.campbell.douglas@gmail.com | +61419933874`;

const MAC_REVIEW_NOTES = `App Review Notes — Hertz Labs v3.0 (macOS / Mac Catalyst)

Shared codebase with iOS build 30. Same v3.0 features and compliance posture as iOS notes.

Premium: Mac App Store IAP and App Store Offer Codes only — no custom promo unlock. Promos → Redeem opens Apple's native offer redemption flow.

Photic strobe, focus challenge, referral HZ codes, guided depth, ASMR layers, streak local notifications, cancellation winback, and affiliate Feedback form behave the same as on iOS.

Contact: info.campbell.douglas@gmail.com | +61419933874`;

const LOCALES = ['en-US', 'en-AU'];

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
  return {status: res.status, json};
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

async function findOrCreateVersion(token, platform) {
  const versions = await ascGetAll(token, `/v1/apps/${APP_ID}/appStoreVersions`);
  const existing = versions.find(
    v => v.attributes?.versionString === VERSION_STRING && v.attributes?.platform === platform,
  );
  if (existing) {
    console.log(
      `Using ${platform} v${VERSION_STRING}: ${existing.id} (${existing.attributes?.appStoreState})`,
    );
    return existing;
  }
  const {status, json} = await asc(token, 'POST', '/v1/appStoreVersions', {
    data: {
      type: 'appStoreVersions',
      attributes: {platform, versionString: VERSION_STRING},
      relationships: {app: {data: {type: 'apps', id: APP_ID}}},
    },
  });
  if (status >= 300) {
    throw new Error(`Create ${platform} version failed (${status}): ${JSON.stringify(json)}`);
  }
  console.log(`Created ${platform} v${VERSION_STRING}: ${json.data.id}`);
  return json.data;
}

async function patchWhatsNew(token, versionId, platform) {
  const locs = await ascGetAll(token, `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  const targets = locs.filter(l => LOCALES.includes(l.attributes?.locale ?? ''));
  if (targets.length === 0) {
    console.warn(`WARN: No ${LOCALES.join('/')} localizations on ${platform} v${VERSION_STRING}`);
    return;
  }
  for (const loc of targets) {
    const locale = loc.attributes?.locale;
    const {status, json} = await asc(token, 'PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: {
        type: 'appStoreVersionLocalizations',
        id: loc.id,
        attributes: {whatsNew: WHATS_NEW_V30},
      },
    });
    if (status >= 300) {
      throw new Error(`whatsNew ${platform} ${locale} failed (${status}): ${JSON.stringify(json)}`);
    }
    console.log(`OK: ${platform} ${locale} What's New (${WHATS_NEW_V30.length} chars)`);
  }
}

async function patchReviewNotes(token, versionId, platform, notes) {
  const detailRes = await asc(token, 'GET', `/v1/appStoreVersions/${versionId}/appStoreReviewDetail`);
  const detail = detailRes.json?.data;
  if (!detail?.id) {
    console.warn(`WARN: No appStoreReviewDetail for ${platform} v${VERSION_STRING} — set notes in ASC UI`);
    return;
  }
  const {status, json} = await asc(token, 'PATCH', `/v1/appStoreReviewDetails/${detail.id}`, {
    data: {
      type: 'appStoreReviewDetails',
      id: detail.id,
      attributes: {notes},
    },
  });
  if (status >= 300) {
    throw new Error(`Review notes ${platform} failed (${status}): ${JSON.stringify(json)}`);
  }
  console.log(`OK: ${platform} App Review notes (${notes.length} chars)`);
}

async function main() {
  const env = parseEnv(envPath);
  const keyId = (env.APPLE_CONNECT_KEY_ID || 'S6FZD2L3R5').trim();
  const issuer = (env.APPLE_CONNECT_ISSUER_ID || '').trim();
  const keyPath = path.join(root, '.secrets', `AuthKey_${keyId}.p8`);
  if (!issuer || !fs.existsSync(keyPath)) {
    console.error('Missing APPLE_CONNECT_ISSUER_ID or .secrets/AuthKey_*.p8');
    process.exit(1);
  }
  const token = makeJwt({issuer, keyId, pem: fs.readFileSync(keyPath, 'utf8')});

  console.log(`=== Update ASC metadata for v${VERSION_STRING} ===`);
  for (const [platform, reviewNotes] of [
    ['IOS', IOS_REVIEW_NOTES],
    ['MAC_OS', MAC_REVIEW_NOTES],
  ]) {
    const version = await findOrCreateVersion(token, platform);
    await patchWhatsNew(token, version.id, platform);
    await patchReviewNotes(token, version.id, platform, reviewNotes);
  }
  console.log('Done.');
}

main().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});
