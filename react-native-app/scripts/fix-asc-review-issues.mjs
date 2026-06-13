#!/usr/bin/env node
/**
 * Fix ASC issues detectable via API before resubmission.
 * - Re-upload subscription promotional images (1024² PNGs)
 * - Custom EULA + App Description legal links (Guideline 3.1.2)
 * - Add App Review notes for build 8 fixes
 * - Report REJECTED en-AU localizations (manual ASC UI required)
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const APP_ID = '6777604364';
const GROUP_ID = '22147327';
const VERSION_ID = '2bfc2fc7-31fc-44bd-8b3c-7a329172b40a';
const REVIEW_DETAIL_ID = '0c0e0f10-8870-4786-bde6-f17f2783aa19';
const TERMS_URL = 'https://enginelabs-au.github.io/hertzlabs/terms/';
const PRIVACY_URL = 'https://enginelabs-au.github.io/hertzlabs/privacy/';
const SUPPORT_URL = 'https://enginelabs-au.github.io/hertzlabs/support/';
const EULA_TERRITORIES = ['AUS', 'USA'];

const PRODUCT_IMAGES = {
  hertzlabs_bb_monthly: path.join(__dirname, '..', 'assets', 'products', 'product-monthly.png'),
  hertzlabs_bb_annual: path.join(__dirname, '..', 'assets', 'products', 'product-annual.png'),
  hertzlabs_lifetime_ultra: path.join(__dirname, '..', 'assets', 'products', 'product-ultra.png'),
};

const REVIEW_NOTES =
  'Build 8: IAP purchases verified in sandbox. Background audio works for premium subscribers with toggle enabled. Plans menu shows active subscription and paywall for premium users. Solfeggio 639/741/852 Hz fixed in Math mode. Guideline 3.1.2: Custom EULA added in App Store Connect (App Information). App Description includes functional Terms of Use and Privacy Policy links. In-app: Legal menu and onboarding link to the same URLs. Paywall shows auto-renewal terms. Privacy Policy URL is set in App Information.';

function parseEnv(filePath) {
  const out = {};
  let key = null;
  let buf = [];
  const flush = () => {
    if (!key) return;
    out[key] = buf.join('\n').trim().replace(/^["']|["']$/g, '');
    key = null;
    buf = [];
  };
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!key && (!t || t.startsWith('#'))) continue;
    if (!key) {
      const i = line.indexOf('=');
      if (i < 0) continue;
      key = line.slice(0, i).trim();
      buf = [line.slice(i + 1)];
      if (!buf[0].includes('-----BEGIN')) flush();
      continue;
    }
    buf.push(line);
    if (line.includes('-----END')) flush();
  }
  flush();
  return out;
}

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

async function ascRequest(token, method, route, body) {
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
  const items = [];
  let next = `${route}${route.includes('?') ? '&' : '?'}limit=200`;
  while (next) {
    const {status, json} = await ascRequest(token, 'GET', next);
    if (status >= 400) {
      throw new Error(`ASC ${next} failed (${status}): ${JSON.stringify(json)}`);
    }
    items.push(...(json.data ?? []));
    next = json.links?.next ? json.links.next.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  return items;
}

async function uploadBinaryImage(token, {createRoute, type, relationshipKey, resourceId, imagePath, label}) {
  if (!fs.existsSync(imagePath)) {
    console.log(`WARN: missing image for ${label}: ${imagePath}`);
    return;
  }
  const fileName = path.basename(imagePath);
  const fileSize = fs.statSync(imagePath).size;
  const image = fs.readFileSync(imagePath);

  const {status, json} = await ascRequest(token, 'POST', createRoute, {
    data: {
      type,
      attributes: {fileName, fileSize},
      relationships: {
        [relationshipKey]: {
          data: {
            type: relationshipKey === 'subscription' ? 'subscriptions' : 'inAppPurchases',
            id: resourceId,
          },
        },
      },
    },
  });
  if (status >= 300) {
    console.log(`WARN: ${label} image reserve failed (${status}): ${json.errors?.[0]?.detail ?? ''}`);
    return;
  }

  const imageId = json.data.id;
  const op = json.data.attributes?.uploadOperations?.[0];
  if (!op?.url) {
    console.log(`WARN: ${label} image: no upload URL`);
    return;
  }

  const uploadRes = await fetch(op.url, {
    method: op.method ?? 'PUT',
    headers: Object.fromEntries((op.requestHeaders ?? []).map(h => [h.name, h.value])),
    body: image,
  });
  if (!uploadRes.ok) {
    console.log(`WARN: ${label} image upload failed (${uploadRes.status})`);
    return;
  }

  const {status: patchStatus} = await ascRequest(token, 'PATCH', `${createRoute}/${imageId}`, {
    data: {type, id: imageId, attributes: {uploaded: true}},
  });
  if (patchStatus < 300) {
    console.log(`FIXED: ${label} promotional image uploaded`);
  } else {
    console.log(`WARN: ${label} image commit failed (${patchStatus})`);
  }
}

const LEGAL_FOOTER = `\n\nNot a medical device. Consult a healthcare provider before use if you have epilepsy, a pacemaker, or are pregnant.\n\nTerms of Use (EULA): ${TERMS_URL}\nPrivacy Policy: ${PRIVACY_URL}`;

const TRIMMABLE_COPY = [
  {
    from: 'Headphones strongly recommended for binaural modes — stereo separation is essential for the dichotic effect.',
    to: 'Headphones recommended for binaural modes (stereo separation required).',
  },
];

function ensureDescriptionLegalLinks(description) {
  if (!description) return description.trimEnd() + LEGAL_FOOTER;
  if (description.includes(TERMS_URL)) return description;

  let next = description;
  const legalIdx = next.indexOf('Terms of Use (EULA):');
  if (legalIdx >= 0) next = next.slice(0, legalIdx).trimEnd();
  next = next
    .replace(/\n\nHertz Labs is a wellness tool[^\n]*$/s, '')
    .replace(/\n\nHertz Labs is a wellness and research tool[^\n]*$/s, '')
    .trimEnd();

  for (const {from, to} of TRIMMABLE_COPY) {
    if (next.includes(from)) next = next.replace(from, to);
  }

  if (next.length + LEGAL_FOOTER.length > 4000) {
    throw new Error(
      `App description too long after legal footer (${next.length + LEGAL_FOOTER.length}/4000). Shorten copy manually.`,
    );
  }
  return next + LEGAL_FOOTER;
}

function customEulaText() {
  return `HERTZ LABS — TERMS OF USE (EULA)

Full terms: ${TERMS_URL}

By using Hertz Labs you agree to these Terms. Hertz Labs is a wellness audio tool, not a medical device. Subscriptions (Monthly, Annual) include a 7-day free trial and auto-renew unless cancelled at least 24 hours before the end of the current period. Manage or cancel in Apple ID Settings → Subscriptions. Payment is charged to your Apple ID at confirmation. Lifetime Ultra is a one-time non-consumable purchase. Refunds are handled by Apple per App Store policies.

Privacy Policy: ${PRIVACY_URL}
Support: ${SUPPORT_URL}`;
}

async function ensureCustomEula(token) {
  const existing = await ascRequest(token, 'GET', `/v1/apps/${APP_ID}/endUserLicenseAgreement`);
  const eulaId = existing.json?.data?.id;
  const agreementText = customEulaText();
  const territoryData = EULA_TERRITORIES.map(id => ({type: 'territories', id}));

  if (eulaId) {
    const {status} = await ascRequest(token, 'PATCH', `/v1/endUserLicenseAgreements/${eulaId}`, {
      data: {
        type: 'endUserLicenseAgreements',
        id: eulaId,
        attributes: {agreementText},
        relationships: {territories: {data: territoryData}},
      },
    });
    if (status < 300) {
      console.log('FIXED: Custom EULA updated in App Information');
    } else {
      console.log(`WARN: Could not update custom EULA (${status})`);
    }
    return;
  }

  const {status} = await ascRequest(token, 'POST', '/v1/endUserLicenseAgreements', {
    data: {
      type: 'endUserLicenseAgreements',
      attributes: {agreementText},
      relationships: {
        app: {data: {type: 'apps', id: APP_ID}},
        territories: {data: territoryData},
      },
    },
  });
  if (status < 300) {
    console.log('FIXED: Custom EULA created in App Information');
  } else {
    console.log(`WARN: Could not create custom EULA (${status})`);
  }
}

async function ensureAppDescriptionLegalLinks(token) {
  const locs = await ascGetAll(token, `/v1/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations`);
  for (const loc of locs) {
    const locale = loc.attributes?.locale ?? loc.id;
    const description = loc.attributes?.description ?? '';
    const updated = ensureDescriptionLegalLinks(description);
    if (updated === description) {
      console.log(`OK: ${locale} description already includes Terms link`);
      continue;
    }
    const {status} = await ascRequest(token, 'PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: {
        type: 'appStoreVersionLocalizations',
        id: loc.id,
        attributes: {description: updated},
      },
    });
    if (status < 300) {
      console.log(`FIXED: ${locale} App Description updated with Terms of Use + Privacy links`);
    } else {
      console.log(`WARN: Could not update ${locale} description (${status})`);
    }
  }
}

async function ensurePrivacyPolicyUrls(token) {
  const appInfos = await ascGetAll(token, `/v1/apps/${APP_ID}/appInfos`);
  for (const info of appInfos) {
    const locs = await ascGetAll(token, `/v1/appInfos/${info.id}/appInfoLocalizations`);
    for (const loc of locs) {
      const locale = loc.attributes?.locale ?? loc.id;
      const current = loc.attributes?.privacyPolicyUrl ?? '';
      if (current === PRIVACY_URL) {
        console.log(`OK: ${locale} privacyPolicyUrl set`);
        continue;
      }
      const {status} = await ascRequest(token, 'PATCH', `/v1/appInfoLocalizations/${loc.id}`, {
        data: {
          type: 'appInfoLocalizations',
          id: loc.id,
          attributes: {privacyPolicyUrl: PRIVACY_URL},
        },
      });
      if (status < 300) {
        console.log(`FIXED: ${locale} privacyPolicyUrl set`);
      } else {
        console.log(`WARN: Could not set ${locale} privacyPolicyUrl (${status})`);
      }
    }
  }
}

async function replaceSubscriptionPromoImage(token, subscriptionId, productId) {
  const imagePath = PRODUCT_IMAGES[productId];
  const existing = await ascRequest(token, 'GET', `/v1/subscriptions/${subscriptionId}/images`);
  for (const img of existing.json?.data ?? []) {
    await ascRequest(token, 'DELETE', `/v1/subscriptionImages/${img.id}`);
    console.log(`FIXED: removed old promo image for ${productId}`);
  }
  await uploadBinaryImage(token, {
    createRoute: '/v1/subscriptionImages',
    type: 'subscriptionImages',
    relationshipKey: 'subscription',
    resourceId: subscriptionId,
    imagePath,
    label: productId,
  });
}

async function main() {
  const env = parseEnv(envPath);
  const token = makeJwt({
    issuer: env.APPLE_CONNECT_ISSUER_ID.trim(),
    keyId: env.APPLE_CONNECT_KEY_ID || 'LYRCN33Z95',
    pem: env.APPLE_CONNECT_API_KEY,
  });

  console.log('--- Fix ASC review issues ---');

  await ensureCustomEula(token);
  await ensurePrivacyPolicyUrls(token);
  await ensureAppDescriptionLegalLinks(token);

  const {status: noteStatus} = await ascRequest(token, 'PATCH', `/v1/appStoreReviewDetails/${REVIEW_DETAIL_ID}`, {
    data: {
      type: 'appStoreReviewDetails',
      id: REVIEW_DETAIL_ID,
      attributes: {notes: REVIEW_NOTES},
    },
  });
  if (noteStatus < 300) {
    console.log('FIXED: App Review notes updated on version 1.0');
  } else {
    console.log(`WARN: Could not update review notes (${noteStatus})`);
  }

  const subs = await ascGetAll(token, `/v1/subscriptionGroups/${GROUP_ID}/subscriptions`);
  const manual = [];
  for (const sub of subs) {
    const pid = sub.attributes?.productId;
    await ascRequest(token, 'PATCH', `/v1/subscriptions/${sub.id}`, {
      data: {
        type: 'subscriptions',
        id: sub.id,
        attributes: {reviewNote: REVIEW_NOTES},
      },
    });
    if (PRODUCT_IMAGES[pid]) {
      await replaceSubscriptionPromoImage(token, sub.id, pid);
    }
    const locs = await ascGetAll(token, `/v1/subscriptions/${sub.id}/subscriptionLocalizations`);
    for (const loc of locs) {
      const state = loc.attributes?.state;
      const locale = loc.attributes?.locale;
      if (state === 'REJECTED') {
        manual.push(
          `Subscription ${pid} localization ${locale} is REJECTED — open ASC → Subscriptions → ${pid} → ${locale}, edit and resubmit (API cannot modify REJECTED localizations).`,
        );
      }
    }
    const refreshed = await ascRequest(token, 'GET', `/v1/subscriptions/${sub.id}`);
    console.log(`OK: ${pid} state=${refreshed.json?.data?.attributes?.state ?? 'unknown'}`);
  }

  const iaps = await ascGetAll(token, `/v1/apps/${APP_ID}/inAppPurchasesV2`);
  const lifetime = iaps.find(i => i.attributes?.productId === 'hertzlabs_lifetime_ultra');
  if (lifetime) {
    await ascRequest(token, 'PATCH', `/v2/inAppPurchases/${lifetime.id}`, {
      data: {
        type: 'inAppPurchases',
        id: lifetime.id,
        attributes: {reviewNote: REVIEW_NOTES},
      },
    });
    const locs = await ascGetAll(token, `/v2/inAppPurchases/${lifetime.id}/inAppPurchaseLocalizations`);
    for (const loc of locs) {
      if (loc.attributes?.state === 'REJECTED') {
        manual.push(
          `Lifetime IAP localization ${loc.attributes?.locale} is REJECTED — fix manually in ASC In-App Purchases UI.`,
        );
      }
    }
    const refreshed = await ascRequest(token, 'GET', `/v2/inAppPurchases/${lifetime.id}`);
    console.log(`OK: lifetime state=${refreshed.json?.data?.attributes?.state ?? 'unknown'}`);
  }

  const version = await ascRequest(token, 'GET', `/v1/appStoreVersions/${VERSION_ID}`);
  console.log(`\nVersion 1.0 appStoreState=${version.json?.data?.attributes?.appStoreState}`);

  if (manual.length) {
    console.log('\n--- Manual fixes required in App Store Connect ---');
    manual.forEach(line => console.log(`  • ${line}`));
  } else {
    console.log('\nNo manual IAP localization fixes flagged.');
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
