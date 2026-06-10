#!/usr/bin/env node
/**
 * Populates App Store Connect IAP metadata (localizations, prices, review notes, screenshots).
 * Never prints secret values.
 */
import crypto from 'crypto';
import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const ICON_PATH = path.join(
  __dirname,
  '..',
  'ios',
  'HertzLabsBinauralBeats',
  'Images.xcassets',
  'AppIcon.appiconset',
  'AppIcon-1024.png',
);
const SCREENSHOT_PATH = path.join(__dirname, '.iap-review-screenshot.png');

const BUNDLE_ID = 'com.hertzlabs.binauralbeats';
const APP_ID = '6777604364';
const GROUP_ID = '22147327';

const REVIEW_NOTE =
  'Unlocks premium engine modes (0-500 Hz), AI Guide, background audio, and advanced presets. Shown via Upgrade to Premium paywall.';

const LOCALES = [
  {
    locale: 'en-US',
    subscriptions: {
      monthly: {
        name: 'Hertz Labs Premium Monthly',
        description: 'All engine modes, frequencies & background audio.',
      },
      annual: {
        name: 'Hertz Labs Premium Annual',
        description: 'Full year of premium access. 7-day free trial.',
      },
    },
    lifetime: {
      name: 'Hertz Labs Lifetime Ultra',
      description: 'One-time unlock for all premium features forever.',
    },
  },
  {
    locale: 'en-AU',
    subscriptions: {
      monthly: {
        name: 'Hertz Labs Premium Monthly',
        description: 'All engine modes, frequencies & background audio.',
      },
      annual: {
        name: 'Hertz Labs Premium Annual',
        description: 'Full access all year. 7-day free trial included.',
      },
    },
    lifetime: {
      name: 'Hertz Labs Lifetime Ultra',
      description: 'One-time unlock for all premium features forever.',
    },
  },
];

const PRODUCT_IDS = {
  monthly: 'hertzlabs_bb_monthly',
  annual: 'hertzlabs_bb_annual',
  lifetime: 'hertzlabs_lifetime_ultra',
};

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

function logOk(msg) {
  console.log(`OK: ${msg}`);
}
function logFix(msg) {
  console.log(`FIXED: ${msg}`);
}
function logWarn(msg) {
  console.log(`WARN: ${msg}`);
}

async function upsertSubscriptionLocalization(token, subscriptionId, productId, locale, meta) {
  const locs = await ascGetAll(token, `/v1/subscriptions/${subscriptionId}/subscriptionLocalizations`);
  const existing = locs.find(l => l.attributes?.locale === locale);
  if (existing) {
    const {status, json} = await ascRequest(
      token,
      'PATCH',
      `/v1/subscriptionLocalizations/${existing.id}`,
      {
        data: {
          type: 'subscriptionLocalizations',
          id: existing.id,
          attributes: {name: meta.name, description: meta.description},
        },
      },
    );
    if (status >= 300) {
      logWarn(`Could not update ${productId} ${locale} (${status})`);
      return;
    }
    logFix(`Updated ${productId} localization (${locale})`);
    return;
  }
  const {status, json} = await ascRequest(token, 'POST', '/v1/subscriptionLocalizations', {
    data: {
      type: 'subscriptionLocalizations',
      attributes: {name: meta.name, description: meta.description, locale},
      relationships: {subscription: {data: {type: 'subscriptions', id: subscriptionId}}},
    },
  });
  if (status >= 300) {
    logWarn(`Could not create ${productId} ${locale} (${status}): ${json.errors?.[0]?.detail ?? ''}`);
    return;
  }
  logFix(`Added ${productId} localization (${locale})`);
}

async function upsertIapLocalization(token, iapId, locale, meta) {
  const locs = await ascGetAll(token, `/v2/inAppPurchases/${iapId}/inAppPurchaseLocalizations`);
  const existing = locs.find(l => l.attributes?.locale === locale);
  if (existing) {
    const {status} = await ascRequest(token, 'PATCH', `/v1/inAppPurchaseLocalizations/${existing.id}`, {
      data: {
        type: 'inAppPurchaseLocalizations',
        id: existing.id,
        attributes: {name: meta.name, description: meta.description},
      },
    });
    if (status >= 300) {
      logWarn(`Could not update lifetime ${locale} (${status})`);
      return;
    }
    logFix(`Updated lifetime localization (${locale})`);
    return;
  }
  const {status, json} = await ascRequest(token, 'POST', '/v1/inAppPurchaseLocalizations', {
    data: {
      type: 'inAppPurchaseLocalizations',
      attributes: {name: meta.name, description: meta.description, locale},
      relationships: {inAppPurchaseV2: {data: {type: 'inAppPurchases', id: iapId}}},
    },
  });
  if (status >= 300) {
    logWarn(`Could not create lifetime ${locale} (${status}): ${json.errors?.[0]?.detail ?? ''}`);
    return;
  }
  logFix(`Added lifetime localization (${locale})`);
}

function ensureReviewScreenshotFile() {
  if (fs.existsSync(SCREENSHOT_PATH)) return;
  if (!fs.existsSync(ICON_PATH)) {
    throw new Error('AppIcon-1024.png not found for review screenshot generation');
  }
  const py = `
from PIL import Image, ImageDraw
src = ${JSON.stringify(ICON_PATH)}
out = ${JSON.stringify(SCREENSHOT_PATH)}
W, H = 1242, 2688
bg = Image.new('RGB', (W, H), (8, 10, 18))
draw = ImageDraw.Draw(bg)
icon = Image.open(src).convert('RGBA').resize((320, 320), Image.LANCZOS)
bg.paste(icon, ((W-320)//2, 420), icon)
draw.text((W//2, 820), 'Hertz Labs Premium', fill=(251, 191, 36), anchor='mm')
draw.text((W//2, 900), 'Unlock all engine modes & frequencies', fill=(220, 220, 230), anchor='mm')
bg.save(out, 'PNG')
`;
  execSync(`python3 -c ${JSON.stringify(py)}`);
  logFix('Generated 1242×2688 IAP review screenshot');
}

async function ensureLifetimePrice(token, iapId, targetUsd = 19.99) {
  const {status} = await ascRequest(token, 'GET', `/v2/inAppPurchases/${iapId}/iapPriceSchedule`);
  if (status === 200) {
    logOk('Lifetime price schedule exists');
    return;
  }
  const points = await ascGetAll(token, `/v2/inAppPurchases/${iapId}/pricePoints?filter[territory]=USA`);
  let best = null;
  let bestDiff = Infinity;
  for (const p of points) {
    const price = Number(p.attributes?.customerPrice ?? NaN);
    if (!Number.isFinite(price)) continue;
    const diff = Math.abs(price - targetUsd);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p;
    }
  }
  if (!best || bestDiff > 0.02) {
    logWarn(`No lifetime price point near $${targetUsd}`);
    return;
  }
  const priceId = `${iapId}-price-usa`;
  const {status: postStatus, json} = await ascRequest(token, 'POST', '/v1/inAppPurchasePriceSchedules', {
    data: {
      type: 'inAppPurchases',
      id: iapId,
      relationships: {
        prices: {data: [{type: 'inAppPurchasePrices', id: priceId}]},
      },
    },
    included: [
      {
        type: 'inAppPurchasePrices',
        id: priceId,
        attributes: {startDate: null},
        relationships: {
          inAppPurchaseV2: {data: {type: 'inAppPurchases', id: iapId}},
          inAppPurchasePricePoint: {data: {type: 'inAppPurchasePricePoints', id: best.id}},
        },
      },
    ],
  });
  if (postStatus >= 300) {
    logWarn(`Could not set lifetime price (${postStatus}): ${json.errors?.[0]?.detail ?? ''}`);
    return;
  }
  logFix(`Set lifetime price ~$${targetUsd}`);
}

async function deleteFailedScreenshot(token, screenshotRoute, deleteRoutePrefix) {
  const check = await ascRequest(token, 'GET', screenshotRoute);
  const data = check.json?.data;
  const state = data?.attributes?.assetDeliveryState?.state;
  if (data?.id && state === 'FAILED') {
    await ascRequest(token, 'DELETE', `${deleteRoutePrefix}/${data.id}`);
    logFix(`Removed failed review screenshot for ${screenshotRoute}`);
  }
}

async function uploadAssetScreenshot(token, {type, route, relationshipKey, resourceId, label, screenshotRoute, deleteRoutePrefix}) {
  if (screenshotRoute) {
    await deleteFailedScreenshot(token, screenshotRoute, deleteRoutePrefix);
    const check = await ascRequest(token, 'GET', screenshotRoute);
    const state = check.json?.data?.attributes?.assetDeliveryState?.state;
    if (state === 'COMPLETE' || state === 'UPLOAD_COMPLETE') {
      logOk(`${label} review screenshot already uploaded`);
      return;
    }
  }

  ensureReviewScreenshotFile();

  const fileName = path.basename(SCREENSHOT_PATH);
  const fileSize = fs.statSync(SCREENSHOT_PATH).size;
  const image = fs.readFileSync(SCREENSHOT_PATH);

  const {status, json} = await ascRequest(token, 'POST', route, {
    data: {
      type,
      attributes: {fileName, fileSize},
      relationships: {
        [relationshipKey]: {data: {type: relationshipKey === 'subscription' ? 'subscriptions' : 'inAppPurchases', id: resourceId}},
      },
    },
  });
  if (status >= 300) {
    logWarn(`${label} screenshot reservation failed (${status}): ${json.errors?.[0]?.detail ?? ''}`);
    return;
  }

  const screenshotId = json.data.id;
  const op = json.data.attributes?.uploadOperations?.[0];
  if (!op?.url) {
    logWarn(`${label} screenshot: no upload URL in response`);
    return;
  }

  const uploadRes = await fetch(op.url, {
    method: op.method ?? 'PUT',
    headers: Object.fromEntries((op.requestHeaders ?? []).map(h => [h.name, h.value])),
    body: image,
  });
  if (!uploadRes.ok) {
    logWarn(`${label} screenshot upload failed (${uploadRes.status})`);
    return;
  }

  const {status: patchStatus, json: patchJson} = await ascRequest(
    token,
    'PATCH',
    `${route}/${screenshotId}`,
    {
      data: {
        type,
        id: screenshotId,
        attributes: {uploaded: true},
      },
    },
  );
  if (patchStatus >= 300) {
    logWarn(`${label} screenshot commit failed (${patchStatus}): ${patchJson.errors?.[0]?.detail ?? ''}`);
    return;
  }
  logFix(`${label} review screenshot uploaded`);
}

async function main() {
  const env = parseEnv(envPath);
  const issuer = (env.APPLE_CONNECT_ISSUER_ID || '').trim();
  const apiKeyId = (env.APPLE_CONNECT_KEY_ID || 'LYRCN33Z95').trim();
  const apiPem = env.APPLE_CONNECT_API_KEY || '';
  if (!issuer || !apiPem.includes('BEGIN PRIVATE KEY')) {
    console.error('Missing APPLE_CONNECT_ISSUER_ID or APPLE_CONNECT_API_KEY in .env');
    process.exit(1);
  }

  const token = makeJwt({issuer, keyId: apiKeyId, pem: apiPem});
  console.log('--- Populate ASC IAP metadata ---');

  const subs = await ascGetAll(token, `/v1/subscriptionGroups/${GROUP_ID}/subscriptions`);
  const subByPid = Object.fromEntries(subs.map(s => [s.attributes?.productId, s]));

  for (const pid of [PRODUCT_IDS.monthly, PRODUCT_IDS.annual]) {
    const sub = subByPid[pid];
    if (!sub) {
      logWarn(`Subscription not found: ${pid}`);
      continue;
    }
    const displayName =
      pid === PRODUCT_IDS.monthly ? 'Hertz Labs Premium Monthly' : 'Hertz Labs Premium Annual';
    const {status} = await ascRequest(token, 'PATCH', `/v1/subscriptions/${sub.id}`, {
      data: {
        type: 'subscriptions',
        id: sub.id,
        attributes: {name: displayName, reviewNote: REVIEW_NOTE},
      },
    });
    if (status < 300) logFix(`Updated ${pid} reference name + review note`);
    else logWarn(`Could not PATCH ${pid} (${status})`);

    for (const pack of LOCALES) {
      const meta = pack.subscriptions[pid === PRODUCT_IDS.monthly ? 'monthly' : 'annual'];
      await upsertSubscriptionLocalization(token, sub.id, pid, pack.locale, meta);
    }

    await uploadAssetScreenshot(token, {
      type: 'subscriptionAppStoreReviewScreenshots',
      route: '/v1/subscriptionAppStoreReviewScreenshots',
      relationshipKey: 'subscription',
      resourceId: sub.id,
      label: pid,
      screenshotRoute: `/v1/subscriptions/${sub.id}/appStoreReviewScreenshot`,
      deleteRoutePrefix: '/v1/subscriptionAppStoreReviewScreenshots',
    });

    const refreshed = await ascRequest(token, 'GET', `/v1/subscriptions/${sub.id}`);
    logOk(`${pid} state=${refreshed.json?.data?.attributes?.state ?? 'unknown'}`);
  }

  const iaps = await ascGetAll(token, `/v1/apps/${APP_ID}/inAppPurchasesV2`);
  const lifetime = iaps.find(i => i.attributes?.productId === PRODUCT_IDS.lifetime);
  if (!lifetime) {
    logWarn('Lifetime IAP not found');
  } else {
    const {status} = await ascRequest(token, 'PATCH', `/v2/inAppPurchases/${lifetime.id}`, {
      data: {
        type: 'inAppPurchases',
        id: lifetime.id,
        attributes: {reviewNote: REVIEW_NOTE},
      },
    });
    if (status < 300) logFix('Updated lifetime reference name + review note');
    else logWarn(`Could not PATCH lifetime (${status})`);

    for (const pack of LOCALES) {
      await upsertIapLocalization(token, lifetime.id, pack.locale, pack.lifetime);
    }
    await ensureLifetimePrice(token, lifetime.id, 19.99);
    await uploadAssetScreenshot(token, {
      type: 'inAppPurchaseAppStoreReviewScreenshots',
      route: '/v1/inAppPurchaseAppStoreReviewScreenshots',
      relationshipKey: 'inAppPurchaseV2',
      resourceId: lifetime.id,
      label: PRODUCT_IDS.lifetime,
      screenshotRoute: `/v2/inAppPurchases/${lifetime.id}/appStoreReviewScreenshot`,
      deleteRoutePrefix: '/v1/inAppPurchaseAppStoreReviewScreenshots',
    });

    const refreshed = await ascRequest(token, 'GET', `/v2/inAppPurchases/${lifetime.id}`);
    logOk(`${PRODUCT_IDS.lifetime} state=${refreshed.json?.data?.attributes?.state ?? 'unknown'}`);
  }

  console.log('\n--- Done ---');
  console.log('If any product still shows Missing Metadata, open it in ASC and check for remaining required fields.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
