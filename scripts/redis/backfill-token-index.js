/**
 * Backfill token-link index from legacy customer records.
 *
 * Scans all customer:* records in Redis, reads rewards[] from each, and
 * populates the index sets so that:
 *   business:{businessId}:customers, token:{tokenId}:customers,
 *   customer:{customerId}:businesses, customer:{customerId}:tokens
 * match the current rewards[] data.
 *
 * New token-related activity (customer sync via replace()) will keep the
 * index updated automatically; this script is for one-time backfill of
 * existing data.
 *
 * Usage (from canny-carrot-api):
 *   node scripts/redis/backfill-token-index.js
 *
 * Requirements: npm run build. Uses REDIS_URL from .env at canny-carrot-api root.
 *
 * See: CODEX/TOKEN_LINK_INDEXES.md, scripts/redis/README.md
 */
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env not found at canny-carrot-api root. Create it and add REDIS_URL.');
  process.exitCode = 1;
  process.exit(1);
}
require('dotenv').config({ path: envPath });
if (!process.env.REDIS_URL || !process.env.REDIS_URL.trim()) {
  console.error('REDIS_URL not found in .env. Add REDIS_URL to .env at canny-carrot-api root.');
  process.exitCode = 1;
  process.exit(1);
}

const { connectRedis, redisClient, REDIS_KEYS } = require('../../dist/config/redis');

/** Campaign item ids are "campaign-{documentId}-{slug}". Return document id for token:{campaignDocId}:customers. */
function campaignDocIdFromItemId(itemId) {
  if (!itemId || !itemId.startsWith('campaign-')) return null;
  const after = itemId.slice(9);
  const first = after.split('-')[0];
  return first || null;
}

/** Token-link index: token id = document id for both rewards and campaigns. No prefix. */
function getBusinessIdsAndTokenIds(rewards) {
  const businessIds = new Set();
  const tokenIds = new Set();
  const campaignDocIds = new Set();
  if (!Array.isArray(rewards)) return { businessIds, tokenIds, campaignDocIds };
  for (const r of rewards) {
    const tid = (r.id ?? '').toString().trim();
    const rawBid = (r.businessId ?? '').toString().trim();
    const rawBName = (r.businessName ?? '').toString().trim();
    const bid = rawBName && rawBName.startsWith('business_') ? rawBName : rawBid;
    if (bid) businessIds.add(bid);
    if (tid) tokenIds.add(tid);
    const cDocId = campaignDocIdFromItemId(tid);
    if (cDocId) campaignDocIds.add(cDocId);
  }
  return { businessIds, tokenIds, campaignDocIds };
}

async function scanCustomerIds() {
  const ids = [];
  let cursor = '0';
  do {
    const [next, keys] = await redisClient.scan(cursor, 'MATCH', 'customer:*', 'COUNT', 200);
    cursor = next;
    for (const key of keys || []) {
      if (key.startsWith('customer:email:') || key.startsWith('customer:phone:')) continue;
      const id = key.slice('customer:'.length);
      if (!id || id.includes(':')) continue;
      ids.push(id);
    }
  } while (cursor !== '0');
  return [...new Set(ids)];
}

async function run() {
  await connectRedis();

  const customerIds = await scanCustomerIds();
  console.log(`Found ${customerIds.length} customer record(s). Backfilling index...\n`);

  let processed = 0;
  let withRewards = 0;
  let totalBusinessLinks = 0;
  let totalTokenLinks = 0;

  for (const customerId of customerIds) {
    const raw = await redisClient.get(REDIS_KEYS.customer(customerId));
    if (!raw) continue;
    let record;
    try {
      record = JSON.parse(raw);
    } catch (_) {
      continue;
    }
    const rewards = Array.isArray(record.rewards) ? record.rewards : [];
    const { businessIds, tokenIds, campaignDocIds } = getBusinessIdsAndTokenIds(rewards);
    if (businessIds.size === 0 && tokenIds.size === 0 && campaignDocIds.size === 0) {
      processed++;
      continue;
    }
    withRewards++;

    for (const bid of businessIds) {
      await redisClient.sadd(REDIS_KEYS.businessCustomers(bid), customerId);
      totalBusinessLinks++;
    }
    for (const tid of tokenIds) {
      await redisClient.sadd(REDIS_KEYS.tokenCustomers(tid), customerId);
      totalTokenLinks++;
    }
    for (const cDocId of campaignDocIds) {
      await redisClient.sadd(REDIS_KEYS.tokenCustomers(cDocId), customerId);
      totalTokenLinks++;
    }

    await redisClient.del(REDIS_KEYS.customerBusinesses(customerId));
    await redisClient.del(REDIS_KEYS.customerTokens(customerId));
    for (const bid of businessIds) {
      await redisClient.sadd(REDIS_KEYS.customerBusinesses(customerId), bid);
    }
    for (const tid of tokenIds) {
      await redisClient.sadd(REDIS_KEYS.customerTokens(customerId), tid);
    }

    processed++;
    if (processed % 10 === 0 || processed === customerIds.length) {
      console.log(`  Processed ${processed}/${customerIds.length} customers...`);
    }
  }

  console.log('\n--- Done ---');
  console.log(`Customers processed: ${processed}`);
  console.log(`Customers with rewards (indexed): ${withRewards}`);
  console.log(`business:*:customers SADD count: ${totalBusinessLinks}`);
  console.log(`token:*:customers SADD count: ${totalTokenLinks}`);
  console.log('\nNew token-related activity (customer sync) will keep the index updated.');
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
