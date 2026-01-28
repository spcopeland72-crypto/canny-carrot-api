/**
 * Build Canny Carrot customer record schema in Redis
 *
 * Creates:
 * - customer:{id} — full CustomerRecord (account + rewards array)
 * - customer:email:{normalizedEmail} — index { customerId }
 * - customers:all — SET of customer ids (optional)
 *
 * Seeds Clare Langley (laverickclare@hotmail.com) if missing. Customer id = UUID.
 * Idempotent: skips create when customer or email index already exists.
 *
 * Usage:
 *   npm run build-customer-schema
 *   npx ts-node --transpile-only scripts/build-customer-schema.ts
 *
 * Requires REDIS_URL in .env (canny-carrot-api/.env).
 * Idempotent: skips if customer + email index exist. Use --force to overwrite.
 */

import Redis from 'ioredis';
import { v5 as uuidv5 } from 'uuid';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import type { CustomerRecord } from '../src/types/customerRecord';

dotenv.config({ path: resolve(__dirname, '../.env') });

const REDIS_KEYS = {
  customer: (id: string) => `customer:${id}`,
  customerEmail: (email: string) => `customer:email:${email.toLowerCase().trim()}`,
  customersAll: 'customers:all',
};

/** Deterministic UUID for Clare (idempotent). Primary id is UUID; email is index only. */
const CUSTOMER_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const CLARE_ID = uuidv5('clare-langley', CUSTOMER_NAMESPACE);
const CLARE_EMAIL = 'laverickclare@hotmail.com';

function buildClareRecord(): CustomerRecord {
  const now = new Date().toISOString();
  return {
    id: CLARE_ID,
    email: CLARE_EMAIL,
    firstName: 'Clare',
    lastName: 'Langley',
    phone: '',
    createdAt: now,
    updatedAt: now,
    preferences: {
      notifications: true,
      marketing: false,
    },
    totalStamps: 0,
    totalRedemptions: 0,
    rewards: [],
  };
}

async function main() {
  const force = process.argv.includes('--force');
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('❌ REDIS_URL not set. Use .env or REDIS_URL=...');
    process.exit(1);
  }

  console.log('📡 Connecting to Redis...');
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    commandTimeout: 30000,
    enableReadyCheck: false,
    enableOfflineQueue: false,
  });

  try {
    await redis.ping();
    console.log('✅ Connected\n');

    const existing = await redis.get(REDIS_KEYS.customer(CLARE_ID));
    const emailKey = REDIS_KEYS.customerEmail(CLARE_EMAIL);
    const existingEmail = await redis.get(emailKey);

    if (!force && existing && existingEmail) {
      console.log('ℹ️  Customer record and email index already exist.');
      console.log(`   customer:${CLARE_ID}`);
      console.log(`   ${emailKey}`);
      const parsed = JSON.parse(existing) as CustomerRecord;
      console.log(`   rewards: ${parsed.rewards?.length ?? 0} items`);
      redis.disconnect();
      return;
    }

    const record = buildClareRecord();

    await redis.set(REDIS_KEYS.customer(CLARE_ID), JSON.stringify(record));
    console.log(`✅ SET ${REDIS_KEYS.customer(CLARE_ID)}`);

    await redis.set(emailKey, JSON.stringify({ customerId: CLARE_ID }));
    console.log(`✅ SET ${emailKey} -> { "customerId": "${CLARE_ID}" }`);

    await redis.sadd(REDIS_KEYS.customersAll, CLARE_ID);
    console.log(`✅ SADD ${REDIS_KEYS.customersAll} "${CLARE_ID}"`);

    console.log('\n📋 Customer record (schema):');
    console.log(JSON.stringify(record, null, 2));
    console.log('\n✅ Customer schema built in Redis.');
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}

main();
