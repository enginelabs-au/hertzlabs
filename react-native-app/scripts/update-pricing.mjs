#!/usr/bin/env node
/**
 * Updates subscription and IAP pricing in App Store Connect and Google Play.
 *
 * Target prices:
 *   hertzlabs_bb_annual        → $29.99 / year  (was $24.99)
 *   hertzlabs_lifetime_ultra   → $59.99 one-time (was $19.99)
 *
 * Requires in .env:
 *   APPLE_CONNECT_ISSUER_ID, APPLE_CONNECT_KEY_ID, APPLE_CONNECT_API_KEY
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH (or default path)
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';
import {getGoogleAccessToken, loadServiceAccount, playApiRequest} from './lib/google-play-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, '..');
const envPath = path.join(appRoot, '.env');

const BUNDLE_ID = 'com.hertzlabs.binauralbeats';
const PACKAGE_NAME = 'com.hertzlabs.binauralbeats';
const PLAY_BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;

const PRICE_UPDATES = {
  annual:   {productId: 'hertzlabs_bb_annual',      usd: 29.99},
  lifetime: {productId: 'hertzlabs_lifetime_ultra',  usd: 59.99},
};

// ─── Utilities ───────────────────────────────────────────────────────────────

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function makeJwt({issuer, keyId, pem}) {
  const header  = {alg: 'ES256', kid: keyId, typ: 'JWT'};
  const now     = Math.floor(Date.now() / 1000);
  const payload = {iss: issuer, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1'};
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sign = crypto.createSign('SHA256');
  sign.update(unsigned);
  sign.end();
  const sig = sign.sign({key: crypto.createPrivateKey(pem), dsaEncoding: 'ieee-p1363'});
  return `${unsigned}.${b64url(sig)}`;
}

async function ascReq(token, method, route, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${route}`, {
    method,
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = {raw: text}; }
  return {status: res.status, json};
}

async function ascGetAll(token, route) {
  const items = [];
  let next = `${route}${route.includes('?') ? '&' : '?'}limit=200`;
  while (next) {
    const {status, json} = await ascReq(token, 'GET', next);
    if (status >= 400) throw new Error(`ASC GET ${next} → ${status}: ${JSON.stringify(json)}`);
    items.push(...(json.data ?? []));
    next = json.links?.next
      ? json.links.next.replace('https://api.appstoreconnect.apple.com', '')
      : null;
  }
  return items;
}

function money(usd) {
  const units = Math.floor(usd);
  const nanos = Math.round((usd - units) * 1e9);
  return {currencyCode: 'USD', units: String(units), nanos};
}

function moneyEur(usd) {
  const eur = Math.round(usd * 0.92 * 100) / 100;
  return {currencyCode: 'EUR', units: String(Math.floor(eur)), nanos: Math.round((eur % 1) * 1e9)};
}

function scalePlayPrice(price, ratio) {
  // nanos may be absent for zero-decimal currencies (JPY, KRW, IDR, etc.)
  const nanosNum = Number(price.nanos ?? 0);
  const old = Number(price.units) + nanosNum / 1e9;
  const scaled = old * ratio;
  if (nanosNum === 0) {
    return {currencyCode: price.currencyCode, units: String(Math.round(scaled)), nanos: 0};
  }
  // Standard currency — scale to nearest .99
  const rounded = Math.round(scaled) - 0.01;
  const u = Math.floor(rounded);
  return {currencyCode: price.currencyCode, units: String(u), nanos: Math.round((rounded - u) * 1e9)};
}

function log(tag, msg) { console.log(`${tag.padEnd(6)} ${msg}`); }
const ok   = msg => log('OK   ', msg);
const fix  = msg => log('FIXED', msg);
const warn = msg => log('WARN ', msg);
const fail = msg => log('FAIL ', msg);

// ─── App Store Connect ────────────────────────────────────────────────────────

async function ascFindSubscriptionId(token, appId, productId) {
  const groups = await ascGetAll(token, `/v1/apps/${appId}/subscriptionGroups`);
  for (const group of groups) {
    const subs = await ascGetAll(token, `/v1/subscriptionGroups/${group.id}/subscriptions`);
    const sub = subs.find(s => s.attributes?.productId === productId);
    if (sub) return sub.id;
  }
  return null;
}

async function ascFindPricePoint(token, subscriptionId, targetUsd) {
  const points = await ascGetAll(
    token,
    `/v1/subscriptions/${subscriptionId}/pricePoints?filter[territory]=USA`,
  );
  let best = null, bestDiff = Infinity;
  for (const p of points) {
    const price = Number(p.attributes?.customerPrice ?? NaN);
    if (!Number.isFinite(price)) continue;
    const diff = Math.abs(price - targetUsd);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  if (!best || bestDiff > 0.02) {
    throw new Error(`No USA price point near $${targetUsd} for subscription ${subscriptionId}`);
  }
  return best;
}

function decodePricePointTerritory(id) {
  try { return JSON.parse(Buffer.from(id, 'base64').toString()).t ?? null; } catch { return null; }
}

async function ascUpdateSubscriptionPrice(token, subscriptionId, productId, targetUsd) {
  // Find the USA price point at the target amount
  const usaPricePoint = await ascFindPricePoint(token, subscriptionId, targetUsd);
  ok(`Found price point ${usaPricePoint.id} = $${usaPricePoint.attributes?.customerPrice} for ${productId}`);

  // Collect all territories that already have a future scheduled price
  const allPrices = await ascGetAll(token, `/v1/subscriptions/${subscriptionId}/prices`);
  const alreadyScheduled = new Set(
    allPrices
      .filter(p => p.attributes?.startDate)
      .map(p => p.relationships?.territory?.data?.id)
      .filter(Boolean),
  );

  if (alreadyScheduled.size >= 175) {
    ok(`${productId} already has future prices scheduled for all territories — no change needed`);
    return;
  }

  // Get equivalent price points for all other territories via equalizations
  const equalizations = await ascGetAll(
    token,
    `/v1/subscriptionPricePoints/${usaPricePoint.id}/equalizations`,
  );

  // Tomorrow UTC — Apple requires startDate to be a future date
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const startDate = tomorrow.toISOString().slice(0, 10);

  // Include USA itself plus all equalizations
  const allPricePoints = [
    {id: usaPricePoint.id, territory: 'USA'},
    ...equalizations.map(e => ({id: e.id, territory: decodePricePointTerritory(e.id)})),
  ].filter(e => e.territory && !alreadyScheduled.has(e.territory));

  ok(`Scheduling $${targetUsd} price change for ${allPricePoints.length} territories from ${startDate}...`);

  let scheduled = 0, skipped = 0, failed = 0;
  const BATCH = 10;
  for (let i = 0; i < allPricePoints.length; i += BATCH) {
    const batch = allPricePoints.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(({id}) =>
        ascReq(token, 'POST', '/v1/subscriptionPrices', {
          data: {
            type: 'subscriptionPrices',
            attributes: {startDate},
            relationships: {
              subscription:           {data: {type: 'subscriptions',           id: subscriptionId}},
              subscriptionPricePoint: {data: {type: 'subscriptionPricePoints', id}},
            },
          },
        }),
      ),
    );
    for (const {status} of results) {
      if (status === 201) scheduled++;
      else if (status === 409) skipped++; // already has a future price for this territory
      else failed++;
    }
    if (i + BATCH < allPricePoints.length) {
      await new Promise(r => setTimeout(r, 200)); // gentle rate limiting
    }
  }

  if (failed > 0) {
    fail(`${productId}: ${failed} territory price changes failed (${scheduled} ok, ${skipped} skipped)`);
  } else {
    fix(`${productId}: scheduled $${targetUsd} for ${scheduled} territories from ${startDate} (${skipped} already set)`);
  }
}

async function ascFindIapId(token, appId, productId) {
  const iaps = await ascGetAll(token, `/v1/apps/${appId}/inAppPurchasesV2`);
  const iap = iaps.find(i => i.attributes?.productId === productId);
  return iap?.id ?? null;
}

async function ascFindIapPricePoint(token, iapId, targetUsd) {
  const points = await ascGetAll(
    token,
    `/v2/inAppPurchases/${iapId}/pricePoints?filter[territory]=USA`,
  );
  let best = null, bestDiff = Infinity;
  for (const p of points) {
    const price = Number(p.attributes?.customerPrice ?? NaN);
    if (!Number.isFinite(price)) continue;
    const diff = Math.abs(price - targetUsd);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  if (!best || bestDiff > 0.02) {
    throw new Error(`No USA price point near $${targetUsd} for IAP ${iapId}`);
  }
  return best;
}

async function ascUpdateIapPrice(token, iapId, productId, targetUsd) {
  // Check current price
  const currentPrices = await ascGetAll(
    token,
    `/v1/inAppPurchasePriceSchedules/${iapId}/manualPrices?include=inAppPurchasePricePoint,territory`,
  );
  for (const mp of currentPrices) {
    const ppId = mp.relationships?.inAppPurchasePricePoint?.data?.id;
    const pp = mp._included?.find(i => i.id === ppId);
    // Check via price point id match (included data not always available inline)
    const pricePoint59 = await ascFindIapPricePoint(token, iapId, targetUsd);
    if (ppId === pricePoint59.id) {
      ok(`${productId} already priced at $${targetUsd} — no change needed`);
      return;
    }
    break; // only need to check the first (USA) price
  }

  const pricePoint = await ascFindIapPricePoint(token, iapId, targetUsd);
  ok(`Found IAP price point ${pricePoint.id} = $${pricePoint.attributes?.customerPrice} for ${productId}`);

  // POST /v1/inAppPurchasePriceSchedules — CREATE replaces the active price schedule.
  // Allowed operations: CREATE, GET_INSTANCE (PATCH is not supported).
  // Local IDs in included resources must use the ${local-id} format per ASC spec.
  const tempId = '${newprice_usa}';
  const {status, json} = await ascReq(token, 'POST', '/v1/inAppPurchasePriceSchedules', {
    data: {
      type: 'inAppPurchasePriceSchedules',
      relationships: {
        inAppPurchase:  {data: {type: 'inAppPurchases', id: iapId}},
        baseTerritory:  {data: {type: 'territories',    id: 'USA'}},
        manualPrices:   {data: [{type: 'inAppPurchasePrices', id: tempId}]},
      },
    },
    included: [
      {
        type: 'inAppPurchasePrices',
        id: tempId,
        attributes: {startDate: null},
        relationships: {
          inAppPurchasePricePoint: {data: {type: 'inAppPurchasePricePoints', id: pricePoint.id}},
          territory:               {data: {type: 'territories', id: 'USA'}},
        },
      },
    ],
  });

  if (status >= 300) {
    fail(`Set $${targetUsd} for ${productId} → ${status}: ${JSON.stringify(json?.errors ?? json)}`);
  } else {
    fix(`${productId} price → $${targetUsd} one-time (price point ${pricePoint.id})`);
  }
}

async function runAsc(token) {
  console.log('\n── App Store Connect ──────────────────────────────────────');

  const apps = await ascGetAll(token, `/v1/apps?filter[bundleId]=${BUNDLE_ID}`);
  const app  = apps.find(a => a.attributes?.bundleId === BUNDLE_ID);
  if (!app) throw new Error(`App not found for bundle ${BUNDLE_ID}`);
  ok(`App: ${app.attributes?.name} (${app.id})`);

  // Annual subscription
  const annualSubId = await ascFindSubscriptionId(token, app.id, PRICE_UPDATES.annual.productId);
  if (!annualSubId) {
    fail(`Subscription not found: ${PRICE_UPDATES.annual.productId} — run setup-asc-iap first`);
  } else {
    ok(`Found subscription ${PRICE_UPDATES.annual.productId} (${annualSubId})`);
    await ascUpdateSubscriptionPrice(token, annualSubId, PRICE_UPDATES.annual.productId, PRICE_UPDATES.annual.usd);
  }

  // Lifetime non-consumable
  const lifetimeIapId = await ascFindIapId(token, app.id, PRICE_UPDATES.lifetime.productId);
  if (!lifetimeIapId) {
    fail(`IAP not found: ${PRICE_UPDATES.lifetime.productId} — run setup-asc-iap first`);
  } else {
    ok(`Found IAP ${PRICE_UPDATES.lifetime.productId} (${lifetimeIapId})`);
    await ascUpdateIapPrice(token, lifetimeIapId, PRICE_UPDATES.lifetime.productId, PRICE_UPDATES.lifetime.usd);
  }
}

// ─── Google Play ──────────────────────────────────────────────────────────────

async function playUpdateSubscriptionPrice(token, productId, basePlanId, targetUsd) {
  const {status: gs, json: gj} = await playApiRequest(
    token, 'GET', `${PLAY_BASE}/subscriptions/${productId}`,
  );
  if (gs !== 200) {
    fail(`Play subscription not found: ${productId} (${gs}) — run setup-play-iap first`);
    return;
  }

  const bp = (gj.basePlans ?? []).find(b => b.basePlanId === basePlanId);
  const usRc = (bp?.regionalConfigs ?? []).find(r => r.regionCode === 'US');
  const cur = usRc ? Number(usRc.price?.units ?? 0) + Number(usRc.price?.nanos ?? 0) / 1e9 : null;
  if (cur !== null && Math.abs(cur - targetUsd) < 0.02) {
    ok(`Play ${productId}:${basePlanId} US already $${cur} — no change needed`);
    return;
  }

  // Derive the scale ratio from the old US price so all regional configs are updated proportionally.
  const oldUsd = cur ?? targetUsd; // if no US config found, ratio = 1 (no-op)
  const ratio = targetUsd / oldUsd;
  const updatedBasePlans = (gj.basePlans ?? []).map(b => {
    if (b.basePlanId !== basePlanId) return b;
    return {
      ...b,
      // Scale every regional config: US gets exact USD target, others scale proportionally.
      regionalConfigs: (b.regionalConfigs ?? []).map(rc =>
        rc.regionCode === 'US'
          ? {...rc, price: money(targetUsd)}
          : {...rc, price: scalePlayPrice(rc.price, ratio)},
      ),
      otherRegionsConfig: b.otherRegionsConfig
        ? {...b.otherRegionsConfig, usdPrice: money(targetUsd), eurPrice: moneyEur(targetUsd)}
        : undefined,
    };
  });

  // Use the product's own regionsVersion so existing regional currency assignments are preserved.
  // Subscription responses may omit regionsVersion — fall back to 2025/03 which accepts existing
  // regional currency assignments (e.g. BG=EUR) that older products were created with.
  const rv = gj.regionsVersion?.version ?? '2025/03';
  const url = `${PLAY_BASE}/subscriptions/${productId}?updateMask=basePlans&regionsVersion.version=${encodeURIComponent(rv)}`;
  const {status, json} = await playApiRequest(token, 'PATCH', url, {...gj, basePlans: updatedBasePlans});

  if (status >= 300) {
    fail(`Play ${productId}:${basePlanId} price update → ${status}: ${JSON.stringify(json)}`);
  } else {
    fix(`Play ${productId}:${basePlanId} US price → $${targetUsd}/yr`);
  }
}

async function playUpdateLifetimePrice(token, productId, targetUsd) {
  const {status: gs, json: gj} = await playApiRequest(
    token, 'GET', `${PLAY_BASE}/oneTimeProducts/${productId}`,
  );
  if (gs !== 200) {
    fail(`Play one-time product not found: ${productId} (${gs}) — run setup-play-iap first`);
    return;
  }

  const po = (gj.purchaseOptions ?? [])[0];
  const usConfig = (po?.regionalPricingAndAvailabilityConfigs ?? []).find(r => r.regionCode === 'US');
  const cur = usConfig ? Number(usConfig.price?.units ?? 0) + Number(usConfig.price?.nanos ?? 0) / 1e9 : null;
  if (cur !== null && Math.abs(cur - targetUsd) < 0.02) {
    ok(`Play ${productId} US already $${cur} — no change needed`);
    return;
  }

  // Derive the scale ratio from the old US price so all regional configs are updated proportionally.
  const oldUsd = cur ?? targetUsd;
  const ratio = targetUsd / oldUsd;
  const updatedPurchaseOptions = (gj.purchaseOptions ?? []).map(p => ({
    ...p,
    // Scale every regional config: US gets exact USD target, others scale proportionally.
    regionalPricingAndAvailabilityConfigs: (p.regionalPricingAndAvailabilityConfigs ?? []).map(rc =>
      rc.regionCode === 'US'
        ? {...rc, price: money(targetUsd)}
        : {...rc, price: scalePlayPrice(rc.price, ratio)},
    ),
    newRegionsConfig: p.newRegionsConfig
      ? {...p.newRegionsConfig, usdPrice: money(targetUsd), eurPrice: moneyEur(targetUsd)}
      : undefined,
  }));

  // Use the product's own regionsVersion so existing regional currency assignments are preserved.
  const rv = gj.regionsVersion?.version;
  const {status, json} = await playApiRequest(
    token, 'POST', `${PLAY_BASE}/oneTimeProducts:batchUpdate`,
    {
      requests: [{
        allowMissing: false,
        oneTimeProduct: {...gj, purchaseOptions: updatedPurchaseOptions},
        updateMask: 'purchaseOptions',
        ...(rv ? {regionsVersion: {version: rv}} : {}),
      }],
    },
  );

  if (status >= 300) {
    fail(`Play ${productId} price update → ${status}: ${JSON.stringify(json)}`);
  } else {
    fix(`Play ${productId} US price → $${targetUsd} one-time`);
  }
}

async function runPlay(token) {
  console.log('\n── Google Play ────────────────────────────────────────────');
  ok(`Package: ${PACKAGE_NAME}`);

  await playUpdateSubscriptionPrice(token, PRICE_UPDATES.annual.productId, 'default', PRICE_UPDATES.annual.usd);
  await playUpdateLifetimePrice(token, PRICE_UPDATES.lifetime.productId, PRICE_UPDATES.lifetime.usd);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const env      = parseEnv(envPath);
  const issuer   = (env.APPLE_CONNECT_ISSUER_ID || '').trim();
  const apiKeyId = (env.APPLE_CONNECT_KEY_ID || '').trim();
  const apiPem   = env.APPLE_CONNECT_API_KEY || '';

  if (!issuer || !apiPem.includes('BEGIN PRIVATE KEY')) {
    console.error('Missing APPLE_CONNECT_ISSUER_ID or APPLE_CONNECT_API_KEY in .env');
    process.exit(1);
  }

  const ascToken = makeJwt({issuer, keyId: apiKeyId, pem: apiPem});

  // ASC
  try {
    await runAsc(ascToken);
  } catch (err) {
    fail(`ASC error: ${err.message}`);
  }

  // Google Play
  const credPath = path.join(
    appRoot,
    (env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH || '.secrets/speedy-crawler-499309-s7-7d911ab4f0e8.json').trim(),
  );
  if (!fs.existsSync(credPath)) {
    warn(`Google Play service account not found at ${credPath} — skipping Play price update`);
  } else {
    try {
      const sa    = loadServiceAccount(credPath);
      const token = await getGoogleAccessToken(sa);
      ok('Google OAuth token acquired');
      await runPlay(token);
    } catch (err) {
      fail(`Play error: ${err.message}`);
    }
  }

  console.log('\n── Summary ────────────────────────────────────────────────');
  console.log('Annual:   hertzlabs_bb_annual        → $29.99 / year');
  console.log('Lifetime: hertzlabs_lifetime_ultra   → $59.99 one-time');
  console.log('Price changes apply to new subscribers immediately.');
  console.log('Existing subscribers are not affected until their next renewal cycle.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
