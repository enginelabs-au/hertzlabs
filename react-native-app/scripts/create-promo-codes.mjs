#!/usr/bin/env node
/**
 * Create random promo codes in Supabase.
 *
 * Usage:
 *   node scripts/create-promo-codes.mjs --count 10 --entitlement extended_trial
 *   node scripts/create-promo-codes.mjs --count 5 --entitlement discount_2mo --max-uses 1
 */
import crypto from 'crypto';
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

const count = Math.max(1, Number.parseInt(arg('--count', '1'), 10));
const entitlement = arg('--entitlement', 'extended_trial');
const maxUsesRaw = arg('--max-uses', '1');
const maxUses = maxUsesRaw === 'null' ? null : Number.parseInt(maxUsesRaw, 10);

const PRESETS = {
  extended_trial: {
    label: '3-Month Premium',
    description: 'Enjoy 3 months of Hertz Labs Premium free.',
  },
  lifetime: {
    label: 'Lifetime Premium',
    description: 'Lifetime Hertz Labs Premium access.',
  },
  discount_2mo: {
    label: '2 Months Free',
    description: 'Two free months on any Hertz Labs subscription plan.',
  },
  discount_6mo: {
    label: '6 Months Free',
    description: 'Six free months on any Hertz Labs subscription plan.',
  },
};

const preset = PRESETS[entitlement];
if (!preset) {
  console.error(`Unknown entitlement: ${entitlement}`);
  process.exit(1);
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function listCodes() {
  const res = await fetch(`${baseUrl}/rest/v1/promo_codes?select=code`, {headers});
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return new Set((await res.json()).map(r => r.code));
}

function randomCode(existing) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const seg = n =>
      Array.from({length: n}, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
    const code = `HLP-${seg(4)}-${seg(4)}`;
    if (!existing.has(code)) {
      existing.add(code);
      return code;
    }
  }
  throw new Error('Could not generate unique promo code');
}

async function insertCode(code) {
  const res = await fetch(`${baseUrl}/rest/v1/promo_codes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code,
      entitlement,
      label: preset.label,
      description: preset.description,
      max_uses: maxUses,
      use_count: 0,
      active: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`${code}: ${await res.text()}`);
  }
  return code;
}

const existing = await listCodes();
const created = [];
for (let i = 0; i < count; i += 1) {
  const code = await insertCode(randomCode(existing));
  created.push(code);
}

console.log(`Created ${created.length} ${entitlement} code(s) (max_uses=${maxUses ?? '∞'} each):\n`);
for (const code of created) {
  console.log(code);
}
