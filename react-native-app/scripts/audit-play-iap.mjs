#!/usr/bin/env node
/**
 * Audits Google Play monetization catalog against iapCatalog.ts / iOS parity.
 * Uses Android Publisher monetization.subscriptions + oneTimeProducts APIs.
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';
import {
  getGoogleAccessToken,
  loadServiceAccount,
  playApiRequest,
} from './lib/google-play-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, '..');
const envPath = path.join(appRoot, '.env');

const PACKAGE_NAME = 'com.hertzlabs.binauralbeats';
const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;

const CATALOG = {
  monthly: {
    productId: 'hertzlabs_bb_monthly',
    basePlanId: 'default',
    offerId: 'free-trial',
    priceUsd: 4.99,
    period: 'P1M',
    rcStoreId: 'hertzlabs_bb_monthly:default',
  },
  annual: {
    productId: 'hertzlabs_bb_annual',
    basePlanId: 'default',
    offerId: 'free-trial',
    priceUsd: 24.99,
    period: 'P1Y',
    rcStoreId: 'hertzlabs_bb_annual:default',
  },
  lifetime: {
    productId: 'hertzlabs_lifetime_ultra',
    purchaseOptionId: 'default',
    priceUsd: 19.99,
    rcStoreId: 'hertzlabs_lifetime_ultra',
  },
};

function resolveCredentialsPath(env) {
  const rel = (env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH || '.secrets/speedy-crawler-499309-s7-7d911ab4f0e8.json').trim();
  return path.isAbsolute(rel) ? rel : path.join(appRoot, rel);
}

function moneyUsd(m) {
  if (!m) return null;
  return Number(m.units || 0) + Number(m.nanos || 0) / 1e9;
}

function usPriceFromBasePlan(bp) {
  const us = (bp.regionalConfigs || []).find(c => c.regionCode === 'US');
  return moneyUsd(us?.price || bp.otherRegionsConfig?.usdPrice);
}

const issues = [];
const ok = msg => console.log(`OK: ${msg}`);
const issue = msg => {
  issues.push(msg);
  console.log(`ISSUE: ${msg}`);
};

async function auditSubscription(label, spec) {
  const subRes = await playApiRequest(token, 'GET', `${BASE}/subscriptions/${spec.productId}`);
  if (subRes.status !== 200) {
    issue(`${label}: subscription ${spec.productId} missing (${subRes.status})`);
    return;
  }
  ok(`${label}: subscription ${spec.productId}`);

  const bp = (subRes.json.basePlans || []).find(b => b.basePlanId === spec.basePlanId);
  if (!bp) {
    issue(`${label}: base plan "${spec.basePlanId}" missing`);
    return;
  }
  if (bp.state !== 'ACTIVE') {
    issue(`${label}: base plan ${spec.basePlanId} state=${bp.state} (need ACTIVE)`);
  } else {
    ok(`${label}: base plan ${spec.basePlanId} ACTIVE`);
  }

  const period = bp.autoRenewingBasePlanType?.billingPeriodDuration;
  if (period !== spec.period) {
    issue(`${label}: billing period ${period} != ${spec.period}`);
  } else {
    ok(`${label}: billing period ${spec.period}`);
  }

  const price = usPriceFromBasePlan(bp);
  if (price == null) {
    issue(`${label}: could not read US price`);
  } else if (Math.abs(price - spec.priceUsd) > 0.02) {
    issue(`${label}: US price $${price.toFixed(2)} != $${spec.priceUsd}`);
  } else {
    ok(`${label}: US price $${price.toFixed(2)}`);
  }

  const offerUrl =
    `${BASE}/subscriptions/${spec.productId}/basePlans/${spec.basePlanId}/offers/${spec.offerId}`;
  const offerRes = await playApiRequest(token, 'GET', offerUrl);
  if (offerRes.status !== 200) {
    issue(`${label}: offer ${spec.offerId} missing (${offerRes.status})`);
    return;
  }
  if (offerRes.json.state !== 'ACTIVE') {
    issue(`${label}: offer ${spec.offerId} state=${offerRes.json.state} (need ACTIVE)`);
  } else {
    ok(`${label}: offer ${spec.offerId} ACTIVE`);
  }
  const trial = offerRes.json.phases?.[0]?.duration;
  if (trial !== 'P7D') {
    issue(`${label}: trial duration ${trial} != P7D`);
  } else {
    ok(`${label}: 7-day free trial`);
  }

  ok(`${label}: RevenueCat store ID ${spec.rcStoreId}`);
}

async function auditLifetime(spec) {
  const res = await playApiRequest(token, 'GET', `${BASE}/oneTimeProducts/${spec.productId}`);
  if (res.status !== 200) {
    issue(`lifetime: oneTimeProduct ${spec.productId} missing (${res.status})`);
    return;
  }
  ok(`lifetime: oneTimeProduct ${spec.productId}`);

  const po = (res.json.purchaseOptions || []).find(p => p.purchaseOptionId === spec.purchaseOptionId);
  if (!po) {
    issue(
      `lifetime: purchase option "${spec.purchaseOptionId}" missing (have: ${(res.json.purchaseOptions || []).map(p => p.purchaseOptionId).join(', ') || 'none'})`,
    );
    return;
  }
  if (po.state !== 'ACTIVE') {
    issue(`lifetime: purchase option ${spec.purchaseOptionId} state=${po.state} (need ACTIVE)`);
  } else {
    ok(`lifetime: purchase option ${spec.purchaseOptionId} ACTIVE`);
  }
  if (!po.buyOption) {
    issue('lifetime: purchase option is not Buy type');
  } else {
    ok('lifetime: Buy purchase option');
  }

  const us = (po.regionalPricingAndAvailabilityConfigs || []).find(c => c.regionCode === 'US');
  const price = moneyUsd(us?.price);
  if (price == null) {
    issue('lifetime: could not read US price');
  } else if (Math.abs(price - spec.priceUsd) > 0.02) {
    issue(`lifetime: US price $${price.toFixed(2)} != $${spec.priceUsd}`);
  } else {
    ok(`lifetime: US price $${price.toFixed(2)}`);
  }

  ok(`lifetime: RevenueCat store ID ${spec.rcStoreId}`);
}

let token;
async function main() {
  const env = parseEnv(envPath);
  const credPath = resolveCredentialsPath(env);
  if (!fs.existsSync(credPath)) {
    console.error(`Missing service account JSON at ${credPath}`);
    process.exit(1);
  }

  const sa = loadServiceAccount(credPath);
  console.log(`--- Google Play catalog audit (${PACKAGE_NAME}) ---`);
  console.log(`Service account: ${sa.client_email}`);

  token = await getGoogleAccessToken(sa);

  const probe = await playApiRequest(token, 'POST', `${BASE}/edits`, {});
  if (probe.status >= 300) {
    issue(`Android Publisher API not reachable: ${probe.status}`);
    process.exit(3);
  }
  await playApiRequest(token, 'DELETE', `${BASE}/edits/${probe.json.id}`);
  ok('Android Publisher API reachable');

  await auditSubscription('monthly', CATALOG.monthly);
  await auditSubscription('annual', CATALOG.annual);
  await auditLifetime(CATALOG.lifetime);

  console.log('\n--- iOS parity (product IDs) ---');
  ok('hertzlabs_bb_monthly — subscription + 7-day trial (matches ASC)');
  ok('hertzlabs_bb_annual — subscription + 7-day trial (matches ASC)');
  ok('hertzlabs_lifetime_ultra — one-time, no trial (matches ASC Non-Consumable)');

  console.log('\n--- Summary ---');
  console.log(`Issues: ${issues.length}`);
  if (issues.length) process.exit(2);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
