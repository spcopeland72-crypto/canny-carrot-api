#!/usr/bin/env node
/**
 * Check customer record — all data stored in Redis
 *
 * Fetches the customer record from the API (Redis-backed) and verifies that
 * all expected fields from the app sync body are present. Use to confirm
 * nothing is dropped between app → API → Redis.
 *
 * Expected fields (from app buildSyncBody): id, email, firstName, lastName,
 * phone, dateOfBirth, addressLine1, addressLine2, city, postcode, createdAt,
 * updatedAt, preferences, totalStamps, totalRedemptions, rewards, transactionLog.
 *
 * Usage:
 *   node scripts/redis/check-customer-record-redis.js laverickclare@hotmail.com
 *   node scripts/redis/check-customer-record-redis.js --email laverickclare@hotmail.com
 *   node scripts/redis/check-customer-record-redis.js --id <customer-uuid>
 *
 * Env:
 *   API_URL  API base (default https://api.cannycarrot.com)
 *
 * Exit: 0 if record exists and all expected keys present (or optional keys omitted); 1 if missing record or required keys.
 *
 * See: scripts/redis/README.md
 */

const API_URL = process.env.API_URL || 'https://api.cannycarrot.com';

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};
const email = getArg('--email') || getArg('-e') || (args[0] && !args[0].startsWith('-') ? args[0] : null);
const id = getArg('--id') || getArg('-i');

if (!email && !id) {
  console.error('Usage: node scripts/redis/check-customer-record-redis.js <email>');
  console.error('   or: node scripts/redis/check-customer-record-redis.js --email <email>');
  console.error('   or: node scripts/redis/check-customer-record-redis.js --id <customer-uuid>');
  process.exit(1);
}

const baseUrl = API_URL.replace(/\/$/, '');

/** All top-level keys the app sends in sync body; API must pass through to Redis. */
const EXPECTED_KEYS = [
  'id',
  'email',
  'firstName',
  'lastName',
  'phone',
  'dateOfBirth',
  'addressLine1',
  'addressLine2',
  'city',
  'postcode',
  'createdAt',
  'updatedAt',
  'preferences',
  'totalStamps',
  'totalRedemptions',
  'rewards',
  'transactionLog',
];

/** Required for a valid stored record (API always returns these on GET). */
const REQUIRED_KEYS = ['id', 'email', 'createdAt', 'updatedAt'];

async function fetchByEmail(e) {
  const res = await fetch(`${baseUrl}/api/v1/customers/by-email/${encodeURIComponent(e)}`);
  if (!res.ok) throw new Error(`GET by-email failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.data || j;
}

async function fetchById(customerId) {
  const res = await fetch(`${baseUrl}/api/v1/customers/${encodeURIComponent(customerId)}`);
  if (!res.ok) throw new Error(`GET by-id failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.data || j;
}

function summarize(val) {
  if (val === undefined || val === null) return '(missing)';
  if (Array.isArray(val)) return `array[${val.length}]`;
  if (typeof val === 'object') return 'object';
  if (typeof val === 'string') return val.length > 40 ? val.slice(0, 37) + '...' : val;
  return String(val);
}

async function main() {
  let record;
  if (id) {
    console.log('Fetching customer by id:', id);
    record = await fetchById(id);
  } else {
    console.log('Fetching customer by email:', email);
    record = await fetchByEmail(email);
  }

  if (!record || typeof record !== 'object') {
    console.error('No customer record returned.');
    process.exit(1);
  }

  console.log('\n--- Customer record: all data stored (Redis via API) ---\n');

  let allPresent = true;
  let requiredOk = true;

  for (const key of EXPECTED_KEYS) {
    const present = key in record;
    const val = record[key];
    const summary = summarize(val);
    const required = REQUIRED_KEYS.includes(key);
    if (!present) {
      allPresent = false;
      if (required) requiredOk = false;
    }
    const status = present ? 'ok' : (required ? 'MISSING' : 'absent');
    console.log(`  ${key.padEnd(18)} ${status.padEnd(8)} ${summary}`);
  }

  // Any extra keys stored (e.g. from older app or future fields)
  const storedKeys = Object.keys(record);
  const extra = storedKeys.filter((k) => !EXPECTED_KEYS.includes(k));
  if (extra.length > 0) {
    console.log('\n  Other keys in Redis:', extra.join(', '));
  }

  console.log('\n--- Summary ---');
  console.log('  rewards count:', (record.rewards && record.rewards.length) || 0);
  console.log('  transactionLog count:', (record.transactionLog && record.transactionLog.length) || 0);
  console.log('  All expected keys present:', allPresent);
  console.log('  Required keys present:', requiredOk);

  if (!requiredOk) {
    console.error('\nRequired keys missing. Record may be incomplete.');
    process.exit(1);
  }
  if (!allPresent) {
    console.log('\nSome optional keys absent (ok if app did not send them).');
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
