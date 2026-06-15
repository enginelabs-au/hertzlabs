#!/usr/bin/env node
/**
 * Audits (and optionally repairs) RevenueCat product/offering config.
 * Never prints secret values.
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, '..');
const envPath = path.join(appRoot, '.env');

const EXPECTED = {
  bundleId: 'com.hertzlabs.binauralbeats',
  entitlement: 'premium',
  offering: 'default',
  products: {
    monthly: 'hertzlabs_bb_monthly',
    annual: 'hertzlabs_bb_annual',
    lifetime: 'hertzlabs_lifetime_ultra',
  },
  playProducts: {
    monthly: 'hertzlabs_bb_monthly:default',
    annual: 'hertzlabs_bb_annual:default',
    lifetime: 'hertzlabs_lifetime_ultra',
  },
  packages: {
    monthly: '$rc_monthly',
    annual: '$rc_annual',
    lifetime: '$rc_lifetime',
  },
};

function parseEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  let key = null;
  let buf = [];
  const flush = () => {
    if (!key) return;
    out[key] = buf.join('\n').trim();
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
      if (buf[0].includes('-----END')) flush();
      else if (!buf[0].includes('-----BEGIN')) flush();
      continue;
    }
    buf.push(line);
    if (line.includes('-----END')) flush();
  }
  flush();
  return out;
}

async function rcFetch(secret, route, {method = 'GET', body} = {}) {
  const res = await fetch(`https://api.revenuecat.com/v2${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
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

async function listAll(secret, route) {
  const items = [];
  let next = `${route}${route.includes('?') ? '&' : '?'}limit=50`;
  while (next) {
    const {status, json} = await rcFetch(secret, next.replace('https://api.revenuecat.com/v2', ''));
    if (status >= 400) {
      throw new Error(`${route} failed (${status}): ${JSON.stringify(json)}`);
    }
    items.push(...(json.items ?? []));
    const np = json.next_page;
    next = np ? (np.startsWith('/v2') ? np.slice(3) : np) : null;
  }
  return items;
}

async function v1Offerings(publicKey, platform) {
  const res = await fetch(
    'https://api.revenuecat.com/v1/subscribers/rc-audit-probe/offerings',
    {
      headers: {
        Authorization: `Bearer ${publicKey}`,
        'X-Platform': platform,
      },
    },
  );
  const json = await res.json().catch(() => ({}));
  return {status: res.status, json};
}

const env = parseEnv(envPath);
const secret = (env.REVENUECAT_API_KEY_WEB || '').trim();
const iosPublic = (env.REVENUECAT_API_KEY_IOS || '').trim();
const androidPublic = (env.REVENUECAT_API_KEY_ANDROID || '').trim();

const issues = [];
const actions = [];

function issue(msg) {
  issues.push(msg);
  console.log(`ISSUE: ${msg}`);
}
function ok(msg) {
  console.log(`OK: ${msg}`);
}
function action(msg) {
  actions.push(msg);
  console.log(`ACTION: ${msg}`);
}

if (!secret.startsWith('sk_')) {
  issue('REVENUECAT_API_KEY_WEB missing or not a secret key (must start with sk_)');
  process.exit(1);
}

if (!iosPublic) {
  issue('REVENUECAT_API_KEY_IOS missing');
}
if (!androidPublic || androidPublic.includes('REPLACE')) {
  issue('REVENUECAT_API_KEY_ANDROID missing or placeholder');
}

console.log('--- RevenueCat audit ---');

const {status: projStatus, json: projJson} = await rcFetch(secret, '/projects?limit=20');
if (projStatus >= 400) {
  issue(`Cannot list projects (${projStatus}). Check REVENUECAT_API_KEY_WEB permissions (V2 read/write on project configuration).`);
  console.log(JSON.stringify(projJson, null, 2));
  process.exit(1);
}

const projects = projJson.items ?? [];
if (!projects.length) {
  issue('No RevenueCat projects found for this secret key.');
  process.exit(1);
}

const project = projects[0];
ok(`Project: ${project.name ?? project.id} (${project.id})`);

const apps = await listAll(secret, `/projects/${project.id}/apps`);
const iosApp = apps.find(a => a.type === 'app_store' || a.type === 'ios');
const playApp = apps.find(a => a.type === 'play_store');
if (!iosApp) {
  issue('No iOS App Store app configured in RevenueCat.');
} else {
  const bundle =
    iosApp.app_store?.bundle_id ?? iosApp.ios?.bundle_id ?? iosApp.bundle_id ?? '(unknown)';
  ok(`iOS app: ${iosApp.name ?? iosApp.id} bundle=${bundle}`);
  if (bundle !== EXPECTED.bundleId) {
    issue(`Bundle ID mismatch: RC has "${bundle}", repo expects "${EXPECTED.bundleId}"`);
  }
}
if (!playApp) {
  issue('No Google Play app configured in RevenueCat — run npm run fix:revenuecat:android');
} else {
  const pkg =
    playApp.play_store?.package_name ?? playApp.package_name ?? '(unknown)';
  ok(`Play app: ${playApp.name ?? playApp.id} package=${pkg}`);
  if (pkg !== EXPECTED.bundleId) {
    issue(`Package name mismatch: RC has "${pkg}", repo expects "${EXPECTED.bundleId}"`);
  }
}

const products = await listAll(secret, `/projects/${project.id}/products?expand=items.app`);
function findProduct(storeId, appId) {
  return products.find(p => p.store_identifier === storeId && (!appId || p.app_id === appId));
}

for (const [label, storeId] of Object.entries(EXPECTED.products)) {
  const playStoreId = EXPECTED.playProducts[label];
  const iosProduct = iosApp ? findProduct(storeId, iosApp.id) : null;
  const playProduct = playApp ? findProduct(playStoreId, playApp.id) : null;
  if (!iosProduct) {
    issue(`Missing RC iOS product for ${label}: ${storeId}`);
  } else {
    ok(`iOS product ${storeId} (${iosProduct.type ?? 'unknown type'}, id=${iosProduct.id})`);
  }
  if (!playProduct) {
    issue(`Missing RC Play product for ${label}: ${EXPECTED.playProducts[label]}`);
  } else {
    ok(`Play product ${EXPECTED.playProducts[label]} (${playProduct.type ?? 'unknown type'}, id=${playProduct.id})`);
  }
}

const staleIds = [
  'hertzlabs_monthly_premium',
  'hertzlabs_annual_premium',
  'hertzlabs_premium_monthly',
  'hertzlabs_premium_annual',
];
for (const stale of staleIds) {
  if (products.some(p => p.store_identifier === stale)) {
    issue(`Stale product still in RC (wrong ASC type): ${stale}`);
  }
}

const entitlements = await listAll(secret, `/projects/${project.id}/entitlements`);
let premium = entitlements.find(e => e.lookup_key === EXPECTED.entitlement);
if (!premium) {
  issue(`Entitlement "${EXPECTED.entitlement}" not found in RC`);
} else {
  ok(`Entitlement ${EXPECTED.entitlement} (${premium.id})`);
  const attached = await listAll(
    secret,
    `/projects/${project.id}/entitlements/${premium.id}/products`,
  );
  const attachedIds = new Set(attached.map(p => p.store_identifier));
  for (const storeId of Object.values(EXPECTED.products)) {
    if (!attachedIds.has(storeId)) {
      issue(`Product ${storeId} not attached to entitlement ${EXPECTED.entitlement}`);
    }
  }
}

const offerings = await listAll(
  secret,
  `/projects/${project.id}/offerings?expand=items.package.product`,
);
let currentOffering = offerings.find(o => o.is_current);
const defaultOffering = offerings.find(o => o.lookup_key === EXPECTED.offering);

if (!defaultOffering) {
  issue(`Offering "${EXPECTED.offering}" not found`);
} else {
  ok(
    `Offering ${EXPECTED.offering} (${defaultOffering.id}) is_current=${defaultOffering.is_current}`,
  );
  if (!defaultOffering.is_current) {
    issue(`Offering "${EXPECTED.offering}" exists but is NOT marked Current`);
  }
}

const offeringToInspect = currentOffering ?? defaultOffering;
const packages = offeringToInspect
  ? await listAll(
      secret,
      `/projects/${project.id}/offerings/${offeringToInspect.id}/packages?expand=items.product`,
    )
  : [];

const pkgByLookup = new Map(packages.map(p => [p.lookup_key, p]));
for (const [label, lookup] of Object.entries(EXPECTED.packages)) {
  const expectedStoreId = EXPECTED.products[label];
  const pkg = pkgByLookup.get(lookup.replace('$rc_', '')) ?? pkgByLookup.get(lookup);
  // RC v2 lookup_key may be "monthly" not "$rc_monthly"
  const altKeys = [lookup, lookup.replace('$rc_', ''), `$rc_${label}`];
  const found = packages.find(p => altKeys.includes(p.lookup_key));
  if (!found) {
    issue(`Package missing in offering: ${lookup} → ${expectedStoreId}`);
    continue;
  }
  const attached = found.products?.items ?? [];
  const storeIds = attached
    .map(x => x.product?.store_identifier)
    .filter(Boolean);
  if (!storeIds.includes(expectedStoreId)) {
    issue(
      `Package ${found.lookup_key} does not map to ${expectedStoreId} (has: ${storeIds.join(', ') || 'none'})`,
    );
  } else {
    ok(`Package ${found.lookup_key} → ${expectedStoreId}`);
  }
}

if (iosPublic) {
  const {status, json} = await v1Offerings(iosPublic, 'ios');
  if (status >= 400) {
    issue(`iOS SDK offerings probe failed (${status}): ${json?.message ?? JSON.stringify(json)}`);
  } else {
    const current = json?.current_offering_id ?? json?.offerings?.[0]?.identifier;
    const offering =
      json?.offerings?.find(o => o.identifier === current || o.identifier === 'default') ??
      json?.offerings?.[0];
    const pkgs = offering?.available_packages ?? offering?.packages ?? [];
    ok(`iOS SDK offerings probe: current=${current ?? 'none'}, packages=${pkgs.length}`);
    if (!pkgs.length) {
      issue('iOS SDK sees zero packages — paywall will show Not Ready on iOS');
    }
  }
}

if (androidPublic && !androidPublic.includes('REPLACE')) {
  const {status, json} = await v1Offerings(androidPublic, 'android');
  if (status >= 400) {
    issue(`Android SDK offerings probe failed (${status}): ${json?.message ?? JSON.stringify(json)}`);
  } else {
    const current = json?.current_offering_id ?? json?.offerings?.[0]?.identifier;
    const offering =
      json?.offerings?.find(o => o.identifier === current || o.identifier === 'default') ??
      json?.offerings?.[0];
    const pkgs = offering?.available_packages ?? offering?.packages ?? [];
    ok(`Android SDK offerings probe: current=${current ?? 'none'}, packages=${pkgs.length}`);
    if (!pkgs.length) {
      issue('Android SDK sees zero packages — paywall will show Not Ready on Android');
    }
  }
}

const saPath = (env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH || '.secrets/speedy-crawler-499309-s7-7d911ab4f0e8.json').trim();
const saEmail = (env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || '').trim();
if (!saEmail) {
  action('Set GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL in .env');
}
if (!env.GOOGLE_PLAY_GCP_PROJECT_ID?.trim()) {
  action('Set GOOGLE_PLAY_GCP_PROJECT_ID in .env');
}
action(
  'Enable Google Play Android Developer API on GCP project speedy-crawler-499309-s7 (API console) if setup:play-iap fails with SERVICE_DISABLED',
);
action(
  `RevenueCat → Android app → Service credentials: upload react-native-app/${saPath} (dashboard only — no API upload)`,
);
action(
  `Play Console → Users and permissions → invite ${saEmail || 'service account email'} with View financial data + Manage orders and subscriptions`,
);

const hasAscApi = !!(env.APPLE_CONNECT_API_KEY || '').includes('BEGIN PRIVATE KEY');
const hasAscSub = !!(env.APPLE_CONNECT_SUBSCRIPTION_KEY || '').includes('BEGIN PRIVATE KEY');
const hasKeyId = !!(env.APPLE_CONNECT_KEY_ID || '').trim();
const hasIssuer = !!(env.APPLE_CONNECT_ISSUER_ID || '').trim();

if (!hasAscApi) action('Add APPLE_CONNECT_API_KEY (.p8 contents) to .env for ASC sync');
if (!hasAscSub) action('Add APPLE_CONNECT_SUBSCRIPTION_KEY (.p8 contents) to .env');
if (!hasKeyId || !hasIssuer) {
  action(
    'Add APPLE_CONNECT_KEY_ID and APPLE_CONNECT_ISSUER_ID to .env (from App Store Connect → Users and Access → Integrations)',
  );
  action(
    'Upload IAP .p8 + Key ID + Issuer ID in RevenueCat → Project → Apps → iOS → App Store Connect credentials (dashboard only — not automatable from repo without IDs)',
  );
}

if (iosPublic.startsWith('test_')) {
  action(
    'REVENUECAT_API_KEY_IOS uses test_ prefix — fine for sandbox; switch to appl_ production key before App Store release',
  );
}

console.log('\n--- Summary ---');
console.log(`Issues: ${issues.length}`);
console.log(`Manual actions: ${actions.length}`);
if (issues.length) {
  process.exitCode = 2;
}
