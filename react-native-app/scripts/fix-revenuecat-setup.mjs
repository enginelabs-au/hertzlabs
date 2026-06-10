#!/usr/bin/env node
/**
 * Repairs RevenueCat catalog for Hertz Labs IAPs.
 * Never prints secret values.
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

const PROJECT_ID = 'projfb12b396';
const APP_STORE_APP_ID = 'app80bd01cf47';
const ENTITLEMENT_ID = 'entl6f36969bac';
const OFFERING_ID = 'ofrng81eae1ffe6';
const PACKAGES = {
  monthly: 'pkge6757a51dc8',
  annual: 'pkge851ed34112',
  lifetime: 'pkgefd490f7076',
};
const PRODUCTS = {
  monthly: {store: 'hertzlabs_premium_monthly', display: 'Hertz Labs Premium Monthly', type: 'subscription'},
  annual: {store: 'hertzlabs_premium_annual', display: 'Hertz Labs Premium Annual', type: 'subscription'},
  lifetime: {store: 'hertzlabs_lifetime_ultra', display: 'Hertz Labs Lifetime Ultra', type: 'non_consumable'},
};

function parseEnv(filePath) {
  const out = {};
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

async function detachPackageProducts(secret, packageId) {
  const attached = await listAll(secret, `/projects/${PROJECT_ID}/packages/${packageId}/products`);
  const ids = attached.map(x => x.product?.id).filter(Boolean);
  if (!ids.length) return;
  await rc(secret, 'POST', `/projects/${PROJECT_ID}/packages/${packageId}/actions/detach_products`, {
    product_ids: ids,
  });
}

async function ensureProduct(secret, spec) {
  const all = await listAll(secret, `/projects/${PROJECT_ID}/products?include_archived=true`);
  const existing = all.find(p => p.store_identifier === spec.store && p.app_id === APP_STORE_APP_ID);
  if (existing) {
    console.log(`OK: product exists ${spec.store} (${existing.type}, ${existing.id})`);
    if (existing.type !== spec.type) {
      console.log(`WARN: product ${spec.store} type is ${existing.type}, expected ${spec.type}`);
    }
    return existing.id;
  }
  const {status, json} = await rc(secret, 'POST', `/projects/${PROJECT_ID}/products`, {
    app_id: APP_STORE_APP_ID,
    store_identifier: spec.store,
    display_name: spec.display,
    type: spec.type,
  });
  if (status >= 300) {
    throw new Error(`create ${spec.store} failed: ${status} ${json.message ?? JSON.stringify(json)}`);
  }
  console.log(`FIXED: created product ${spec.store} (${json.type}, ${json.id})`);
  return json.id;
}

async function attachPackage(secret, packageId, productId) {
  await detachPackageProducts(secret, packageId);
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

async function main() {
  const secret = (parseEnv(envPath).REVENUECAT_API_KEY_WEB || '').trim();
  if (!secret.startsWith('sk_')) {
    console.error('REVENUECAT_API_KEY_WEB missing or invalid');
    process.exit(1);
  }

  const productIds = {};
  for (const [key, spec] of Object.entries(PRODUCTS)) {
    productIds[key] = await ensureProduct(secret, spec);
  }

  await rc(secret, 'POST', `/projects/${PROJECT_ID}/entitlements/${ENTITLEMENT_ID}/actions/attach_products`, {
    product_ids: Object.values(productIds),
  });
  console.log('FIXED: attached all products to entitlement premium');

  for (const [key, packageId] of Object.entries(PACKAGES)) {
    await attachPackage(secret, packageId, productIds[key]);
  }

  await rc(secret, 'POST', `/projects/${PROJECT_ID}/offerings/${OFFERING_ID}`, {
    is_current: true,
  });
  console.log('FIXED: marked offering default as current');

  const keys = await listAll(secret, `/projects/${PROJECT_ID}/apps/${APP_STORE_APP_ID}/public_api_keys`);
  const applKey = keys.find(k => k.key?.startsWith('appl_'))?.key;
  if (applKey) {
    const v1 = await fetch('https://api.revenuecat.com/v1/subscribers/rc-fix-verify/offerings', {
      headers: {Authorization: `Bearer ${applKey}`, 'X-Platform': 'ios'},
    }).then(r => r.json());
    const pkgs = v1.offerings?.find(o => o.identifier === 'default')?.packages ?? [];
    console.log(`VERIFY: SDK offerings packages=${pkgs.length}`);
    for (const p of pkgs) {
      console.log(`  ${p.identifier} -> ${p.platform_product_identifier}`);
    }
    if (!pkgs.length) {
      console.log('WARN: SDK still returns 0 packages — App Store Connect products may not be Ready to Submit yet.');
    }
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
