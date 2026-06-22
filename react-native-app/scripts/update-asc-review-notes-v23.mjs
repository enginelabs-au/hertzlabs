#!/usr/bin/env node
/**
 * App Review notes + annual promoted-IAP metadata fixes for v2.3 resubmission.
 * Addresses Guideline 2.3.2 (no price in promoted IAP description) and 3.1.1 (store offer codes only).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

const IOS_REVIEW_DETAIL_ID = '9b944e3f-b2a8-4874-a4d5-a7e92c3c0d09';
const MAC_REVIEW_DETAIL_ID = '921299e2-868b-4109-8c67-699624c6cbec';
const ANNUAL_SUBSCRIPTION_ID = '6778755165';

/** Feature-only copy; ≤45 chars for promoted IAP description. */
const ANNUAL_PROMO_DESCRIPTION = 'All premium modes, AI & background.';
const ANNUAL_DISPLAY_NAME = 'Hertz Labs Premium Annual';

const IOS_REVIEW_NOTES = `App Review Notes — Hertz Labs v2.3 (iOS)

Thank you for the feedback on build 23. Both issues from the prior review are resolved in this submission.

Guideline 2.3.2 — Accurate Metadata (Promoted IAP: Hertz Labs Premium Annual)
We removed all price and trial references from the promoted In-App Purchase metadata for hertzlabs_bb_annual. The promoted description is now feature-only copy within the 45-character limit: "${ANNUAL_PROMO_DESCRIPTION}" Display name remains "${ANNUAL_DISPLAY_NAME}" (no pricing text). Localized pricing continues to appear only on the standard App Store product page.

Guideline 3.1.1 — In-App Purchase (Redeem code)
We removed the previous custom in-app "Redeem code" feature that accepted third-party promo strings and unlocked Premium outside StoreKit. The app no longer validates custom HLP codes or grants promotional entitlements from user-entered codes.

Premium access is unlocked only through Apple In-App Purchase (StoreKit) or official App Store Offer Codes. Rewards and outreach now allocate App Store Offer Codes; users redeem them via Promos → Redeem → "Redeem App Store Offer," which opens Apple's native offer-code redemption page (apps.apple.com/redeem?ctx=offercodes). Premium features activate only after Apple completes the subscription; entitlements sync via RevenueCat after purchase/restore.

How to verify: Promos → Redeem shows store-native redemption only (no custom code unlock). Paywall lists standard IAP subscriptions. Sandbox Apple ID may be used for subscription testing.

Contact: info.campbell.douglas@gmail.com | +61419933874`;

const MAC_REVIEW_NOTES = `App Review Notes — Hertz Labs v2.3 (macOS / Mac Catalyst)

Thank you for the feedback on build 23. Both issues from the prior review are resolved in this Mac Catalyst submission (shared codebase with iOS).

Guideline 2.3.2 — Accurate Metadata (Promoted IAP: Hertz Labs Premium Annual)
We removed all price and trial references from the promoted In-App Purchase metadata for hertzlabs_bb_annual. The promoted description is now feature-only: "${ANNUAL_PROMO_DESCRIPTION}" Display name: "${ANNUAL_DISPLAY_NAME}". Pricing appears only on the App Store product page.

Guideline 3.1.1 — In-App Purchase (Redeem code)
We removed the custom in-app "Redeem code" flow that unlocked Premium outside StoreKit. The Mac app no longer accepts custom promo strings or grants entitlements from user-entered codes.

Premium is unlocked only via Mac App Store In-App Purchase or official App Store Offer Codes. Users redeem offer codes under Promos → Redeem → "Redeem App Store Offer" (opens Apple's native redemption URL). No premium unlock occurs until StoreKit completes the transaction.

How to verify on Mac Catalyst: Promos → Redeem (native store redemption only). Paywall shows standard IAP plans. Sandbox Apple ID for purchase testing.

Demo reference (optional): https://drive.google.com/file/d/1ym92vsPgaVV6zPl6iJKrfKvYQBlAhTBU/view?usp=sharing

Contact: info.campbell.douglas@gmail.com | +61419933874`;

/** Approved localizations that still had trial/price-adjacent promotional copy. */
const ANNUAL_LOCALIZATION_PATCHES = [
  {id: '592ffed0-ed8b-4f23-90cc-5a9d317e7a23', locale: 'en-US'},
  {id: 'ae0c5216-5a2b-4cd2-952c-7e03454d8ed1', locale: 'en-AU'},
];

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

  console.log('--- Annual promoted IAP localizations ---');
  for (const {id, locale} of ANNUAL_LOCALIZATION_PATCHES) {
    const {status, json} = await asc(token, 'PATCH', `/v1/subscriptionLocalizations/${id}`, {
      data: {
        type: 'subscriptionLocalizations',
        id,
        attributes: {
          name: ANNUAL_DISPLAY_NAME,
          description: ANNUAL_PROMO_DESCRIPTION,
        },
      },
    });
    if (status >= 300) {
      const detail = json?.errors?.[0]?.detail ?? JSON.stringify(json?.errors ?? json);
      if (String(detail).includes('Cannot edit SubscriptionLocalization when it is in ACTIVE state')) {
        console.warn(`SKIP ${locale}: localization is ACTIVE (already updated in ASC UI)`);
        continue;
      }
      console.error(`FAIL ${locale} (${id}):`, detail);
      process.exit(1);
    }
    console.log(`OK ${locale}: "${json?.data?.attributes?.description}"`);
  }

  console.log('\n--- App Review notes ---');
  for (const [label, detailId, notes] of [
    ['iOS 2.3', IOS_REVIEW_DETAIL_ID, IOS_REVIEW_NOTES],
    ['macOS 2.3', MAC_REVIEW_DETAIL_ID, MAC_REVIEW_NOTES],
  ]) {
    const {status, json} = await asc(token, 'PATCH', `/v1/appStoreReviewDetails/${detailId}`, {
      data: {
        type: 'appStoreReviewDetails',
        id: detailId,
        attributes: {notes},
      },
    });
    if (status >= 300) {
      console.error(`FAIL ${label}:`, JSON.stringify(json?.errors ?? json));
      process.exit(1);
    }
    console.log(`OK ${label} (${notes.length} chars)`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});
