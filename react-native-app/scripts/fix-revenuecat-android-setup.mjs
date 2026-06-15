#!/usr/bin/env node
/**
 * RevenueCat Google Play mirror of fix-revenuecat-setup.mjs (iOS).
 * Creates Play Store app + products, attaches to entitlement/packages, fetches goog_ SDK key.
 * Never prints secret values.
 */
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv, upsertEnv} from './lib/parse-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

const PROJECT_ID = 'projfb12b396';
const APP_STORE_APP_ID = 'app80bd01cf47';
const ENTITLEMENT_ID = 'entl6f36969bac';
const OFFERING_ID = 'ofrng81eae1ffe6';
const PACKAGE_NAME = 'com.hertzlabs.binauralbeats';
const PLAY_APP_NAME = 'Hertz Labs Binaural Beats (Google Play)';

const PACKAGES = {
  monthly: 'pkge6757a51dc8',
  annual: 'pkge851ed34112',
  lifetime: 'pkgefd490f7076',
};

const BASE_PLAN_ID = 'default';

const PRODUCTS = {
  monthly: {
    store: `hertzlabs_bb_monthly:${BASE_PLAN_ID}`,
    display: 'Hertz Labs Premium Monthly',
    type: 'subscription',
  },
  annual: {
    store: `hertzlabs_bb_annual:${BASE_PLAN_ID}`,
    display: 'Hertz Labs Premium Annual',
    type: 'subscription',
  },
  lifetime: {store: 'hertzlabs_lifetime_ultra', display: 'Hertz Labs Lifetime Ultra', type: 'one_time'},
};

async function rc(secret, method, route, body) {
  const res = await fetch(`https://api.revenuecat.com/v2${route}`, {
    method,
    headers: {Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json'},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return {status: res.status, json};
}

async function listAll(secret, route) {
  const items = [];
  let next = `${route}${route.includes('?') ? '&' : '?'}limit=50`;
  while (next) {
    const {status, json} = await rc(secret, 'GET', next);
    if (status >= 400) throw new Error(`${route} -> ${status} ${json.message ?? JSON.stringify(json)}`);
    items.push(...(json.items ?? []));
    next = json.next_page ? json.next_page.replace(/^\/v2/, '') : null;
  }
  return items;
}

async function ensurePlayApp(secret) {
  const apps = await listAll(secret, `/projects/${PROJECT_ID}/apps`);
  let playApp = apps.find(a => a.type === 'play_store');
  if (playApp) {
    const pkg = playApp.play_store?.package_name ?? playApp.package_name ?? '(unknown)';
    console.log(`OK: Play app exists ${playApp.id} package=${pkg}`);
    if (pkg !== PACKAGE_NAME) {
      console.log(`WARN: RC Play package "${pkg}" != expected "${PACKAGE_NAME}"`);
    }
    return playApp.id;
  }

  const {status, json} = await rc(secret, 'POST', `/projects/${PROJECT_ID}/apps`, {
    name: PLAY_APP_NAME,
    type: 'play_store',
    play_store: {package_name: PACKAGE_NAME},
  });
  if (status >= 300) {
    throw new Error(`create Play app failed: ${status} ${json.message ?? JSON.stringify(json)}`);
  }
  console.log(`FIXED: created Play app ${json.id} package=${PACKAGE_NAME}`);
  return json.id;
}

async function ensureProduct(secret, playAppId, spec) {
  const all = await listAll(secret, `/projects/${PROJECT_ID}/products?include_archived=true`);
  const existing = all.find(p => p.store_identifier === spec.store && p.app_id === playAppId);
  if (existing) {
    console.log(`OK: product exists ${spec.store} (${existing.type}, ${existing.id})`);
    if (existing.type !== spec.type) {
      console.log(`WARN: product ${spec.store} type is ${existing.type}, expected ${spec.type}`);
    }
    return existing.id;
  }

  let displayName = spec.display;
  let {status, json} = await rc(secret, 'POST', `/projects/${PROJECT_ID}/products`, {
    app_id: playAppId,
    store_identifier: spec.store,
    display_name: displayName,
    type: spec.type,
  });
  if (status === 409 && String(json.message ?? '').includes('display_name')) {
    displayName = `${spec.display} (${spec.store})`;
    ({status, json} = await rc(secret, 'POST', `/projects/${PROJECT_ID}/products`, {
      app_id: playAppId,
      store_identifier: spec.store,
      display_name: displayName,
      type: spec.type,
    }));
  }
  if (status >= 300) {
    throw new Error(`create ${spec.store} failed: ${status} ${json.message ?? JSON.stringify(json)}`);
  }
  console.log(`FIXED: created product ${spec.store} (${json.type}, ${json.id})`);
  return json.id;
}

async function attachEntitlementProducts(secret, productIds) {
  const attached = await listAll(secret, `/projects/${PROJECT_ID}/entitlements/${ENTITLEMENT_ID}/products`);
  const attachedSet = new Set(attached.map(p => p.id));
  const toAttach = productIds.filter(id => !attachedSet.has(id));
  if (!toAttach.length) {
    console.log('OK: entitlement premium already has all Play products');
    return;
  }
  await rc(secret, 'POST', `/projects/${PROJECT_ID}/entitlements/${ENTITLEMENT_ID}/actions/attach_products`, {
    product_ids: toAttach,
  });
  console.log(`FIXED: attached ${toAttach.length} Play product(s) to entitlement premium`);
}

async function attachPackageProduct(secret, packageId, productId) {
  const attached = await listAll(secret, `/projects/${PROJECT_ID}/packages/${packageId}/products`);
  const already = attached.some(x => x.product?.id === productId);
  if (already) {
    console.log(`OK: package ${packageId} already has product ${productId}`);
    return;
  }
  const {status, json} = await rc(
    secret,
    'POST',
    `/projects/${PROJECT_ID}/packages/${packageId}/actions/attach_products`,
    {products: [{product_id: productId, eligibility_criteria: 'all'}]},
  );
  if (status >= 300) {
    throw new Error(`attach package ${packageId} failed: ${status} ${json.message ?? JSON.stringify(json)}`);
  }
  console.log(`FIXED: attached ${productId} to package ${packageId}`);
}

async function fetchAndSaveAndroidPublicKey(secret, playAppId) {
  const keys = await listAll(secret, `/projects/${PROJECT_ID}/apps/${playAppId}/public_api_keys`);
  const googKey = keys.find(k => k.key?.startsWith('goog_'))?.key;
  if (!googKey) {
    console.log('WARN: no goog_ public API key found — create one in RevenueCat dashboard');
    return null;
  }
  upsertEnv(envPath, 'REVENUECAT_API_KEY_ANDROID', googKey);
  console.log('FIXED: wrote REVENUECAT_API_KEY_ANDROID to .env');
  return googKey;
}

async function verifyAndroidOfferings(googKey) {
  const v1 = await fetch('https://api.revenuecat.com/v1/subscribers/rc-android-fix-verify/offerings', {
    headers: {Authorization: `Bearer ${googKey}`, 'X-Platform': 'android'},
  }).then(r => r.json());
  const pkgs = v1.offerings?.find(o => o.identifier === 'default')?.packages ?? [];
  console.log(`VERIFY: Android SDK offerings packages=${pkgs.length}`);
  for (const p of pkgs) {
    console.log(`  ${p.identifier} -> ${p.platform_product_identifier}`);
  }
  if (!pkgs.length) {
    console.log('WARN: SDK still returns 0 Android packages — upload Play service credentials + create Play products.');
  }
}

async function main() {
  const secret = (parseEnv(envPath).REVENUECAT_API_KEY_WEB || '').trim();
  if (!secret.startsWith('sk_')) {
    console.error('REVENUECAT_API_KEY_WEB missing or invalid in react-native-app/.env');
    console.error('Add your RevenueCat secret key (sk_…) from Dashboard → Project → API keys → Secret API keys.');
    process.exit(1);
  }

  const playAppId = await ensurePlayApp(secret);

  const productIds = {};
  for (const [key, spec] of Object.entries(PRODUCTS)) {
    productIds[key] = await ensureProduct(secret, playAppId, spec);
  }

  await attachEntitlementProducts(secret, Object.values(productIds));

  for (const [key, packageId] of Object.entries(PACKAGES)) {
    await attachPackageProduct(secret, packageId, productIds[key]);
  }

  await rc(secret, 'POST', `/projects/${PROJECT_ID}/offerings/${OFFERING_ID}`, {is_current: true});
  console.log('OK: offering default is current');

  const googKey = await fetchAndSaveAndroidPublicKey(secret, playAppId);
  if (googKey) {
    await verifyAndroidOfferings(googKey);
  }

  console.log('\nMANUAL: RevenueCat → Android app → Service credentials → upload .secrets/speedy-crawler-499309-s7-7d911ab4f0e8.json');
  console.log('MANUAL: Play Console → Users and permissions → invite revenuecat-play-sync@speedy-crawler-499309-s7.iam.gserviceaccount.com');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
