#!/usr/bin/env node
/**
 * Backup customer record
 *
 * Fetches the current customer record from the API (Redis-backed) and writes
 * a timestamped copy to backups/customers/. Run before risky operations so
 * you have a restore point.
 *
 * Usage:
 *   node scripts/redis/backup-customer-record.js laverickclare@hotmail.com
 *   node scripts/redis/backup-customer-record.js --email laverickclare@hotmail.com
 *   node scripts/redis/backup-customer-record.js --id bbc62a7c-9f55-5382-b6ad-be4ecb53514e
 *
 * Env:
 *   API_URL  API base (default https://api.cannycarrot.com)
 *
 * Output:
 *   canny-carrot-api/backups/customers/customer-{id}-{timestamp}.json
 *
 * See: scripts/redis/README.md
 */

const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'https://api.cannycarrot.com';
const BASE = process.env.API_BACKUP_BASE || path.resolve(__dirname, '../../backups/customers');

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};
const email = getArg('--email') || getArg('-e') || (args[0] && !args[0].startsWith('-') ? args[0] : null);
const id = getArg('--id') || getArg('-i');

if (!email && !id) {
  console.error('Usage: node scripts/redis/backup-customer-record.js <email>');
  console.error('   or: node scripts/redis/backup-customer-record.js --email <email>');
  console.error('   or: node scripts/redis/backup-customer-record.js --id <customer-uuid>');
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
    console.log('Fetching customer by id:', id);
    record = await fetchById(id);
  } else {
    console.log('Fetching customer by email:', email);
    record = await fetchByEmail(email);
  }

  if (!record || !record.id) {
    console.error('No customer record returned.');
    process.exit(1);
  }

  const customerId = record.id;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `customer-${customerId}-${timestamp}.json`;
  const dir = path.join(BASE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filepath = path.join(dir, filename);

  fs.writeFileSync(filepath, JSON.stringify(record, null, 2), 'utf8');

  console.log('Backup written:', filepath);
  console.log('Customer id:', customerId);
  console.log('Email (in record):', record.email || '(empty)');
  console.log('transactionLog entries:', (record.transactionLog || []).length);
  console.log('rewards entries:', (record.rewards || []).length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
