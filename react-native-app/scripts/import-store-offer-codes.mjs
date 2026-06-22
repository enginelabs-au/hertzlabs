#!/usr/bin/env node
/**
 * Import App Store / Google Play offer codes from CSV into store_offer_code_pool.
 *
 * Apple: download one-time codes CSV from ASC → Subscription Offer Codes → Download
 * Google: download one-time codes CSV from Play Console → Promotions
 *
 * Usage:
 *   node scripts/import-store-offer-codes.mjs --store apple --tier 1_month --file ~/Downloads/apple-1mo.csv
 *   node scripts/import-store-offer-codes.mjs --store google --tier 3_month --file ~/Downloads/play-3mo.csv --batch practitioner-batch-1
 *   node scripts/import-store-offer-codes.mjs --store apple --tier 1_month --file codes.txt --dry-run
 *
 * Tier: 1_month (post, beta, review) | 3_month (practitioner)
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = parseEnv(path.join(root, '.env'));

const baseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!baseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const store = arg('--store', '');
const tier = arg('--tier', '');
const file = arg('--file', '');
const batch = arg('--batch', `import-${new Date().toISOString().slice(0, 10)}`);
const dryRun = args.includes('--dry-run');

if (store !== 'apple' && store !== 'google') {
  console.error('Required: --store apple|google');
  process.exit(1);
}
if (tier !== '1_month' && tier !== '3_month') {
  console.error('Required: --tier 1_month|3_month');
  process.exit(1);
}
if (!file || !fs.existsSync(file)) {
  console.error('Required: --file path/to/codes.csv');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

function parseCodes(raw, storeKind) {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const codes = [];
  for (const line of lines) {
    if (/^promotion code$/i.test(line) || /^code$/i.test(line) || /^offer code$/i.test(line)) {
      continue;
    }
    const parts = line.split(/[,;\t]/).map(p => p.trim().replace(/^["']|["']$/g, ''));
    let candidate = null;

    if (storeKind === 'apple') {
      const first = parts[0] ?? '';
      if (first.length >= 4 && !/^https?:\/\//i.test(first)) {
        candidate = first;
      } else {
        const urlPart = parts.find(p => /apps\.apple\.com\/redeem/i.test(p));
        if (urlPart != null) {
          try {
            const u = new URL(urlPart);
            candidate = u.searchParams.get('code') ?? '';
          } catch {
            const m = urlPart.match(/[?&]code=([^&]+)/i);
            candidate = m?.[1] ?? '';
          }
        }
      }
    } else {
      candidate = parts.find(p => p.length >= 4 && !/^https?:\/\//i.test(p)) ?? parts[0];
    }

    if (candidate == null || candidate.length < 4) {
      continue;
    }
    if (/^code$/i.test(candidate) || /^promotion code$/i.test(candidate)) {
      continue;
    }
    codes.push(storeKind === 'apple' ? candidate : candidate.toUpperCase());
  }
  return [...new Set(codes)];
}

async function rest(method, pathSuffix, body) {
  const res = await fetch(`${baseUrl}/rest/v1/${pathSuffix}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${pathSuffix} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  const codes = parseCodes(raw, store);
  if (codes.length === 0) {
    console.error('No codes parsed from file.');
    process.exit(1);
  }

  console.log(`Parsed ${codes.length} unique code(s) from ${file}`);
  console.log(`Store: ${store}, tier: ${tier}, batch: ${batch}${dryRun ? ' (dry run)' : ''}`);

  if (dryRun) {
    console.log('Sample:', codes.slice(0, 5).join(', '));
    return;
  }

  const chunkSize = 200;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < codes.length; i += chunkSize) {
    const chunk = codes.slice(i, i + chunkSize).map(code => ({
      store,
      reward_tier: tier,
      code,
      status: 'available',
      batch_label: batch,
    }));
    try {
      await rest('POST', 'store_offer_code_pool', chunk);
      inserted += chunk.length;
    } catch (e) {
      const msg = String(e);
      if (msg.includes('duplicate') || msg.includes('23505')) {
        for (const row of chunk) {
          try {
            await rest('POST', 'store_offer_code_pool', [row]);
            inserted += 1;
          } catch {
            skipped += 1;
          }
        }
      } else {
        throw e;
      }
    }
    process.stdout.write(`\rInserted ${inserted}…`);
  }

  console.log(`\nDone. Inserted ${inserted}, skipped duplicates ${skipped}.`);

  const remaining = await rest(
    'GET',
    `store_offer_code_pool?select=id&store=eq.${store}&reward_tier=eq.${tier}&status=eq.available`,
  );
  console.log(`Available in pool (${store} / ${tier}): ${Array.isArray(remaining) ? remaining.length : '?'}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
