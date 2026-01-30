#!/usr/bin/env node
/**
 * List customer record — everything currently held in Redis
 *
 * Fetches the full customer record from the API (Redis-backed) and prints
 * every key and value. Use to see exactly what is stored for a customer.
 *
 * Usage:
 *   node scripts/redis/list-customer-record-redis.js laverickclare@hotmail.com
 *   node scripts/redis/list-customer-record-redis.js --email <email>
 *   node scripts/redis/list-customer-record-redis.js --id <customer-uuid>
 *
 * Env:
 *   API_URL  API base (default https://api.cannycarrot.com)
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
  console.error('Usage: node scripts/redis/list-customer-record-redis.js <email>');
  console.error('   or: node scripts/redis/list-customer-record-redis.js --email <email>');
  console.error('   or: node scripts/redis/list-customer-record-redis.js --id <customer-uuid>');
  process.exit(1);
}

const baseUrl = API_URL.replace(/\/$/, '');

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

async function main() {
  let record;
  if (id) {
    record = await fetchById(id);
  } else {
    record = await fetchByEmail(email);
  }

  if (!record || typeof record !== 'object') {
    console.error('No customer record returned.');
    process.exit(1);
  }

  console.log('--- Customer record (Redis via API) — full listing ---\n');
  console.log(JSON.stringify(record, null, 2));
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
