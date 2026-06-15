#!/usr/bin/env node
/**
 * Creates / verifies Google Play monetization products to mirror iOS (iapCatalog.ts).
 * Uses service account JSON from .env — never prints private keys.
 *
 * Requires:
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH (or default .secrets/speedy-crawler-499309-s7-7d911ab4f0e8.json)
 *   GOOGLE_PLAY_PACKAGE_NAME (default com.hertzlabs.binauralbeats)
 *
 * Blocked until Play Console account is verified and service account is invited with
 * "View financial data" + "Manage orders and subscriptions".
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
  subscriptions: [
    {
      productId: 'hertzlabs_bb_monthly',
      title: 'Hertz Labs Premium Monthly',
      description: 'Premium frequencies, AI suggestions, and controls.',
      period: 'P1M',
      priceUsd: 4.99,
      trialDays: 7,
    },
    {
      productId: 'hertzlabs_bb_annual',
      title: 'Hertz Labs Premium Annual',
      description: 'Premium frequencies, AI suggestions, and controls.',
      period: 'P1Y',
      priceUsd: 24.99,
      trialDays: 7,
    },
  ],
  lifetime: {
    productId: 'hertzlabs_lifetime_ultra',
    title: 'Hertz Labs Lifetime Ultra',
    description: 'One-time purchase for lifetime premium access.',
    priceUsd: 19.99,
  },
};

function resolveCredentialsPath(env) {
  const rel = (env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH || '.secrets/speedy-crawler-499309-s7-7d911ab4f0e8.json').trim();
  return path.isAbsolute(rel) ? rel : path.join(appRoot, rel);
}

function money(usd) {
  const units = Math.floor(usd);
  const nanos = Math.round((usd - units) * 1e9);
  return {currencyCode: 'USD', units: String(units), nanos};
}

function buildBasePlan(spec) {
  return {
    basePlanId: 'default',
    state: 'DRAFT',
    autoRenewingBasePlanType: {
      billingPeriodDuration: spec.period,
      gracePeriodDuration: 'P3D',
      resubscribeState: 'RESUBSCRIBE_STATE_ACTIVE',
      prorationMode: 'SUBSCRIPTION_PRORATION_MODE_CHARGE_ON_NEXT_BILLING_DATE',
    },
    regionalConfigs: [
      {
        regionCode: 'US',
        newSubscriberAvailability: true,
        price: money(spec.priceUsd),
      },
      {
        regionCode: 'AU',
        newSubscriberAvailability: true,
        price: money(Math.round(spec.priceUsd * 1.55 * 100) / 100),
      },
    ],
    otherRegionsConfig: {
      usdPrice: money(spec.priceUsd),
      eurPrice: money(Math.round(spec.priceUsd * 0.92 * 100) / 100),
      newSubscriberAvailability: true,
    },
  };
}

async function ensureTrialOffer(token, spec) {
  const offerUrl = `${BASE}/subscriptions/${spec.productId}/basePlans/default/offers/free-trial`;
  const existing = await playApiRequest(token, 'GET', offerUrl);
  if (existing.status === 200) {
    console.log(`OK: trial offer exists ${spec.productId}:default:free-trial`);
    return;
  }

  const body = {
    packageName: PACKAGE_NAME,
    productId: spec.productId,
    basePlanId: 'default',
    offerId: 'free-trial',
    phases: [
      {
        recurrenceCount: 1,
        duration: `P${spec.trialDays}D`,
        regionalConfigs: [
          {regionCode: 'US', free: {}},
          {regionCode: 'AU', free: {}},
        ],
        otherRegionsConfig: {free: {}},
      },
    ],
    regionalConfigs: [
      {regionCode: 'US', newSubscriberAvailability: true},
      {regionCode: 'AU', newSubscriberAvailability: true},
    ],
    targeting: {acquisitionRule: {}},
  };

  const createUrl =
    `${BASE}/subscriptions/${spec.productId}/basePlans/default/offers` +
    '?offerId=free-trial&regionsVersion.version=2025/01';
  const created = await playApiRequest(token, 'POST', createUrl, body);
  if (created.status >= 300) {
    throw new Error(`CREATE offer ${spec.productId} -> ${created.status} ${JSON.stringify(created.json)}`);
  }
  console.log(`FIXED: created 7-day trial offer for ${spec.productId}`);
}

async function ensureSubscription(token, spec) {
  const getUrl = `${BASE}/subscriptions/${spec.productId}`;
  const existing = await playApiRequest(token, 'GET', getUrl);
  if (existing.status === 200) {
    console.log(`OK: subscription exists ${spec.productId}`);
    if (spec.trialDays > 0) {
      await ensureTrialOffer(token, spec);
    }
    return;
  }
  if (existing.status !== 404) {
    throw new Error(`GET subscription ${spec.productId} -> ${existing.status} ${JSON.stringify(existing.json)}`);
  }

  const body = {
    productId: spec.productId,
    packageName: PACKAGE_NAME,
    listings: [
      {
        languageCode: 'en-US',
        title: spec.title,
        description: spec.description,
      },
    ],
    basePlans: [buildBasePlan(spec)],
  };

  const createUrl = `${BASE}/subscriptions?productId=${encodeURIComponent(spec.productId)}&regionsVersion.version=2025/01`;
  const created = await playApiRequest(token, 'POST', createUrl, body);
  if (created.status >= 300) {
    throw new Error(`CREATE subscription ${spec.productId} -> ${created.status} ${JSON.stringify(created.json)}`);
  }
  console.log(`FIXED: created subscription ${spec.productId} (DRAFT — activate in Play Console)`);
  if (spec.trialDays > 0) {
    await ensureTrialOffer(token, spec);
  }
}

async function ensureLifetimeProduct(token, spec) {
  const getUrl = `${BASE}/oneTimeProducts/${spec.productId}`;
  const existing = await playApiRequest(token, 'GET', getUrl);
  if (existing.status === 200) {
    const po = (existing.json.purchaseOptions || []).find(p => p.purchaseOptionId === 'default');
    console.log(
      `OK: one-time product exists ${spec.productId}` +
        (po ? ` (purchase option default state=${po.state ?? 'unknown'})` : ''),
    );
    return;
  }
  if (existing.status !== 404) {
    throw new Error(`GET oneTimeProduct ${spec.productId} -> ${existing.status} ${JSON.stringify(existing.json)}`);
  }

  const body = {
    requests: [
      {
        allowMissing: true,
        oneTimeProduct: {
          packageName: PACKAGE_NAME,
          productId: spec.productId,
          listings: [{languageCode: 'en-US', title: spec.title, description: spec.description}],
          purchaseOptions: [
            {
              purchaseOptionId: 'default',
              buyOption: {legacyCompatible: true},
              regionalPricingAndAvailabilityConfigs: [
                {
                  regionCode: 'US',
                  price: money(spec.priceUsd),
                  availability: 'AVAILABLE',
                },
              ],
              newRegionsConfig: {
                usdPrice: money(spec.priceUsd),
                eurPrice: money(Math.round(spec.priceUsd * 0.92 * 100) / 100),
                availability: 'AVAILABLE',
              },
            },
          ],
        },
        updateMask: 'listings,purchaseOptions',
        regionsVersion: {version: '2025/01'},
      },
    ],
  };

  const created = await playApiRequest(token, 'POST', `${BASE}/oneTimeProducts:batchUpdate`, body);
  if (created.status >= 300) {
    throw new Error(`CREATE oneTimeProduct ${spec.productId} -> ${created.status} ${JSON.stringify(created.json)}`);
  }
  console.log(`FIXED: created one-time product ${spec.productId} (activate purchase option in Play Console if DRAFT)`);
}

async function probePlayAccess(token) {
  const edits = await playApiRequest(token, 'POST', `${BASE}/edits`, {});
  if (edits.status >= 300) {
    return {ok: false, detail: `edits probe ${edits.status}: ${JSON.stringify(edits.json)}`};
  }
  const editId = edits.json?.id;
  if (editId) {
    await playApiRequest(token, 'DELETE', `${BASE}/edits/${editId}`);
  }
  return {ok: true, detail: 'Android Publisher API reachable'};
}

async function main() {
  const env = parseEnv(envPath);
  const credPath = resolveCredentialsPath(env);
  if (!fs.existsSync(credPath)) {
    console.error(`Missing service account JSON at ${credPath}`);
    process.exit(1);
  }

  const sa = loadServiceAccount(credPath);
  console.log(`Using service account: ${sa.client_email}`);
  console.log(`Package: ${PACKAGE_NAME}`);

  let token;
  try {
    token = await getGoogleAccessToken(sa);
    console.log('OK: Google OAuth token acquired');
  } catch (err) {
    console.error(`BLOCKED: ${err.message}`);
    console.error('Ensure Google Play Android Developer API is enabled on GCP project speedy-crawler-499309-s7.');
    process.exit(2);
  }

  const probe = await probePlayAccess(token);
  if (!probe.ok) {
    console.error(`BLOCKED: Play Console API not accessible — ${probe.detail}`);
    console.error(
      'Likely causes: Play developer account not verified yet, service account not invited in Play Console → Users and permissions, or missing Financial/Orders permissions.',
    );
    process.exit(3);
  }
  console.log(`OK: ${probe.detail}`);

  for (const sub of CATALOG.subscriptions) {
    await ensureSubscription(token, sub);
  }
  await ensureLifetimeProduct(token, CATALOG.lifetime);

  console.log('\nNext: Play Console → activate products, link payments profile, upload AAB to Internal testing.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
