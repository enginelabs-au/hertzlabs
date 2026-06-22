#!/usr/bin/env node
/**
 * Reset promo testing state in Supabase for one RC user (or all users).
 *
 *   node scripts/reset-promo-test-state.mjs --rc-user-id '$RCAnonymousID:...'
 *   node scripts/reset-promo-test-state.mjs --all
 */
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
const all = args.includes('--all');
const rcIdx = args.indexOf('--rc-user-id');
const rcUserId = rcIdx >= 0 ? args[rcIdx + 1]?.trim() : '';

if (!all && rcUserId.length === 0) {
  console.error('Usage: --rc-user-id <id> | --all');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

async function rest(method, pathSuffix, body) {
  const res = await fetch(`${baseUrl}/rest/v1/${pathSuffix}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${pathSuffix} → ${res.status}: ${text}`);
  }
  if (res.status === 204) {
    return null;
  }
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return res.json();
  }
  return null;
}

async function releasePoolCodes(filterQuery) {
  const rows = await rest('GET', `store_offer_code_pool?select=id,code,status&${filterQuery}`);
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }
  for (const row of rows) {
    await rest('PATCH', `store_offer_code_pool?id=eq.${row.id}`, {
      status: 'available',
      submission_type: null,
      submission_id: null,
      rc_user_id: null,
      reserved_at: null,
      assigned_at: null,
    });
  }
  return rows.length;
}

async function deleteForUser(table, column = 'rc_user_id') {
  await rest('DELETE', `${table}?${column}=eq.${encodeURIComponent(rcUserId)}`);
}

async function resetUser() {
  console.log(`Resetting promo state for ${rcUserId}…`);

  const released = await releasePoolCodes(
    `rc_user_id=eq.${encodeURIComponent(rcUserId)}&status=in.(reserved,assigned)`,
  );
  console.log(`  Released ${released} store offer code(s) back to pool`);

  await deleteForUser('promo_reward_claims');
  console.log('  Cleared promo_reward_claims');

  await deleteForUser('wellness_checkins');
  console.log('  Cleared wellness_checkins');

  await deleteForUser('post_submissions');
  console.log('  Cleared post_submissions');

  await deleteForUser('practitioner_applications');
  console.log('  Cleared practitioner_applications');

  await deleteForUser('app_messages');
  console.log('  Cleared app_messages');

  await deleteForUser('referrer_profiles');
  console.log('  Cleared referrer_profiles (will re-register on next Promos visit)');

  await rest(
    'DELETE',
    `promo_redemptions?rc_user_id=eq.${encodeURIComponent(rcUserId)}`,
  );
  console.log('  Cleared promo_redemptions (legacy HLP)');

  console.log('Done.');
}

async function resetAll() {
  console.log('Resetting ALL promo testing state…');

  const released = await releasePoolCodes('status=in.(reserved,assigned)');
  console.log(`  Released ${released} store offer code(s)`);

  for (const table of [
    'promo_reward_claims',
    'wellness_checkins',
    'post_submissions',
    'practitioner_applications',
    'app_messages',
    'promo_redemptions',
  ]) {
    await rest('DELETE', `${table}?id=not.is.null`);
    console.log(`  Cleared ${table}`);
  }
  await rest('DELETE', 'referrer_profiles?referrer_code=not.is.null');
  console.log('  Cleared referrer_profiles');

  console.log('Done.');
}

try {
  if (all) {
    await resetAll();
  } else {
    await resetUser();
  }
} catch (err) {
  console.error(err.message ?? err);
  process.exit(1);
}
