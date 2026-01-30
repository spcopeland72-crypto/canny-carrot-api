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

  const displayName = [record.firstName, record.lastName].filter(Boolean).join(' ') || record.name || record.email || record.id;
  console.log('Here\'s the customer view after refresh, login, scanning campaigns, and sync.\n');
  console.log(`Customer account (${displayName})\n`);
  console.log('Field\tValue');
  console.log('id\t', record.id);
  console.log('email\t', record.email ?? '');
  console.log('firstName\t', record.firstName ?? '');
  console.log('lastName\t', record.lastName ?? '');
  console.log('phone\t', record.phone ?? '');
  console.log('createdAt\t', record.createdAt ?? '');
  console.log('updatedAt\t', record.updatedAt ?? '');
  console.log('totalStamps\t', record.totalStamps ?? '');
  console.log('totalRedemptions\t', record.totalRedemptions ?? '');
  console.log('');

  const rewards = Array.isArray(record.rewards) ? record.rewards : [];
  const rewardItems = rewards.filter((r) => (r.tokenKind || r.type) !== 'campaign');
  const campaignItems = rewards.filter((r) => (r.tokenKind || '') === 'campaign' || (r.id && String(r.id).startsWith('campaign-')));

  console.log(`Rewards (${rewardItems.length} rewards)`);
  if (rewardItems.length) {
    console.log('id\tname\tpointsEarned / requirement\ttype');
    for (const r of rewardItems) {
      const req = r.requirement ?? r.total ?? '';
      const typeExtra = r.rewardType ? ` (${(r.selectedProducts || [])[0] || r.rewardType})` : '';
      console.log(`${r.id}\t${r.name || ''}\t${r.pointsEarned ?? r.count ?? 0} / ${req}\t${(r.rewardType || '')}${typeExtra}`);
    }
  } else {
    console.log('(none)');
  }
  console.log('');

  console.log(`Campaigns (${campaignItems.length} in rewards[])`);
  for (let i = 0; i < campaignItems.length; i++) {
    const c = campaignItems[i];
    const name = c.name || c.id || '';
    const req = c.requirement ?? c.total ?? 1;
    const earned = c.pointsEarned ?? c.count ?? 0;
    const prods = Array.isArray(c.selectedProducts) ? c.selectedProducts.join(', ') : '';
    const acts = Array.isArray(c.selectedActions) ? c.selectedActions.join(', ') : '';
    const collected = Array.isArray(c.collectedItems) ? c.collectedItems.map((x) => `${x.itemType} "${x.itemName}"`).join(', ') : '—';
    console.log(`${i + 1}. ${name} (id: ${c.id})`);
    console.log(`   Progress: ${earned} / ${req}`);
    console.log(`   Products: ${prods || '—'}`);
    console.log(`   Actions: ${acts || '—'}`);
    console.log(`   Collected so far: ${collected || '—'}`);
  }
  if (campaignItems.length === 0) {
    console.log('(none)');
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
