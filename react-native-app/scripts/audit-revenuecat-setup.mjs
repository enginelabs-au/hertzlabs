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
    monthly: 'hertzlabs_premium_monthly',
    annual: 'hertzlabs_premium_annual',
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

async function v1Offerings(publicKey) {
  const res = await fetch(
    'https://api.revenuecat.com/v1/subscribers/rc-audit-probe/offerings',
    {
      headers: {
        Authorization: `Bearer ${publicKey}`,
        'X-Platform': 'ios',
      },
    },
  );
  const json = await res.json().catch(() => ({}));
  return {status: res.status, json};
}

const env = parseEnv(envPath);
const secret = (env.REVENUECAT_API_KEY_WEB || '').trim();
const iosPublic = (env.REVENUECAT_API_KEY_IOS || '').trim();

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

const products = await listAll(secret, `/projects/${project.id}/products?expand=items.app`);
const productByStoreId = new Map(
  products.map(p => [p.store_identifier, p]),
);

for (const [label, storeId] of Object.entries(EXPECTED.products)) {
  const p = productByStoreId.get(storeId);
  if (!p) {
    issue(`Missing RC product for ${label}: ${storeId}`);
  } else {
    ok(`Product ${storeId} (${p.type ?? 'unknown type'}, id=${p.id})`);
    if (iosApp && p.app_id && p.app_id !== iosApp.id) {
      issue(`Product ${storeId} attached to wrong app (${p.app_id})`);
    }
  }
}

const staleIds = [
  'hertzlabs_monthly_premium',
  'hertzlabs_annual_premium',
];
for (const stale of staleIds) {
  if (productByStoreId.has(stale)) {
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
  const {status, json} = await v1Offerings(iosPublic);
  if (status >= 400) {
    issue(`SDK offerings probe failed (${status}): ${json?.message ?? JSON.stringify(json)}`);
  } else {
    const current = json?.current_offering_id ?? json?.offerings?.[0]?.identifier;
    const offering =
      json?.offerings?.find(o => o.identifier === current || o.identifier === 'default') ??
      json?.offerings?.[0];
    const pkgs = offering?.available_packages ?? offering?.packages ?? [];
    ok(`SDK offerings probe: current=${current ?? 'none'}, packages=${pkgs.length}`);
    if (!pkgs.length) {
      issue('SDK sees zero packages — paywall will show Not Ready');
    } else {
      for (const p of pkgs) {
        console.log(
          `  package ${p.identifier}: ${p.platform_product_identifier ?? p.product?.identifier ?? '?'}`,
        );
      }
    }
  }
}

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
