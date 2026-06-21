#!/usr/bin/env node
/**
 * Rotate guessable promo_codes to random HLP-XXXX-XXXX values and rename
 * discount entitlements to discount_2mo / discount_6mo.
 *
 * Usage: node scripts/rotate-promo-codes.mjs [--dry-run]
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in react-native-app/.env
 */
import crypto from 'crypto';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = parseEnv(path.join(root, '.env'));
const dryRun = process.argv.includes('--dry-run');

const baseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!baseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

async function rest(method, route, body) {
  const res = await fetch(`${baseUrl}/rest/v1/${route}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${route} failed (${res.status}): ${text}`);
  }
  if (method === 'GET') {
    return res.json();
  }
}

const GUESSABLE = new Set([
  'LAUNCH3MO',
  'FREETRIAL',
  'VIPLIFE',
  'FRIEND20',
  'SAVE50',
  'HZDEV-TRIAL',
  'HZDEV-LIFE',
  'HZDEV-20OFF',
  'HZDEV-50OFF',
  'HZDEV-M2F',
  'HZDEV-M6F',
  'HZ-WELL-TY',
]);

const GUESSABLE_RE =
  /^(LAUNCH|FREE|VIP|FRIEND|SAVE|HZDEV|HZ-WELL|HZ-TRIAL|HZ-LIFE)/i;

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomPromoCode(existing) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const seg = n =>
      Array.from({length: n}, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
    const code = `HLP-${seg(4)}-${seg(4)}`;
    if (!existing.has(code)) {
      return code;
    }
  }
  throw new Error('Could not generate unique promo code');
}

function isGuessable(code) {
  const upper = code.toUpperCase();
  return GUESSABLE.has(upper) || GUESSABLE_RE.test(upper);
}

async function main() {
  const rows = await rest('GET', 'promo_codes?select=*&order=code.asc');

  const existing = new Set(rows.map(r => r.code));
  const rotations = [];

  console.log(`Found ${rows.length} promo_codes${dryRun ? ' (dry run)' : ''}\n`);

  for (const row of rows) {
    if (row.active === false) {
      continue;
    }
    if (!isGuessable(row.code)) {
      continue;
    }

    const newCode = randomPromoCode(existing);
    existing.add(newCode);

    rotations.push({
      oldCode: row.code,
      newCode,
      entitlement: row.entitlement,
      label: row.label,
      description: row.description,
      max_uses: row.max_uses,
      expires_at: row.expires_at,
    });
  }

  if (rotations.length === 0) {
    console.log('No guessable active codes to rotate.');
  }

  for (const r of rotations) {
    console.log(`${r.oldCode} → ${r.newCode} (${r.entitlement}, max_uses=${r.max_uses ?? '∞'})`);
    if (dryRun) {
      continue;
    }

    await rest('POST', 'promo_codes', {
      code: r.newCode,
      entitlement: r.entitlement,
      label: r.label,
      description: r.description,
      max_uses: r.max_uses,
      use_count: 0,
      expires_at: r.expires_at,
      active: true,
    });

    await rest('PATCH', `promo_codes?code=eq.${encodeURIComponent(r.oldCode)}`, {active: false});
  }

  if (!dryRun) {
    await rest('PATCH', 'promo_codes?entitlement=eq.discount_20', {
      entitlement: 'discount_2mo',
      label: '2 Months Free',
      description: 'Two free months on any Hertz Labs subscription plan.',
    });
    await rest('PATCH', 'promo_codes?entitlement=eq.discount_50', {
      entitlement: 'discount_6mo',
      label: '6 Months Free',
      description: 'Six free months on any Hertz Labs subscription plan.',
    });
  }

  console.log(`\nDone. Rotated ${rotations.length} code(s).`);
  if (rotations.length > 0) {
    console.log('\nShare these new codes with users (old codes are deactivated):');
    for (const r of rotations) {
      console.log(`  ${r.newCode}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
