/**
 * Seed Clare Langley's complete customer record in Redis
 *
 * - Account: Clare Langley, laverickclare@hotmail.com (from registration / The Stables)
 * - Rewards + campaigns: from app-repository-data (The Stables) → customer-record shape
 *
 * Creates customer:{id}, customer:email:{email}, customers:all.
 * Use --force to overwrite existing.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/seed-clare-customer-record.ts
 *   npm run seed-clare-customer
 */

import Redis from 'ioredis';
import { v5 as uuidv5 } from 'uuid';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import type { CustomerRecord, CustomerRecordRewardItem } from '../src/types/customerRecord';

dotenv.config({ path: resolve(__dirname, '../.env') });

const REDIS_KEYS = {
  customer: (id: string) => `customer:${id}`,
  customerEmail: (email: string) => `customer:email:${email.toLowerCase().trim()}`,
  customersAll: 'customers:all',
  customerAuthByEmail: (email: string) => `customer:auth:${email.toLowerCase().trim()}`,
};

/** Deterministic UUID for Clare (seed idempotent). Primary id is always UUID; email is index only. */
const CUSTOMER_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const CLARE_ID = uuidv5('clare-langley', CUSTOMER_NAMESPACE);
const CLARE_EMAIL = 'laverickclare@hotmail.com';
/** Default password for Clare (customer login). Use /auth/customer/login. */
const CLARE_DEFAULT_PASSWORD = 'Clare1234';

interface RepoReward {
  id: string;
  businessId?: string;
  name: string;
  stampsRequired?: number;
  selectedProducts?: string[];
  selectedActions?: string[];
  qrCode?: string;
  pinCode?: string;
  pointsPerPurchase?: number;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface RepoCampaign {
  id: string;
  businessId?: string;
  name: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

interface RepoData {
  businessId?: string;
  business?: { profile?: { contactName?: string; email?: string; phone?: string }; name?: string };
  rewards?: RepoReward[];
  campaigns?: RepoCampaign[];
}

function mapRewardToItem(r: RepoReward, businessName: string): CustomerRecordRewardItem {
  const total = r.stampsRequired ?? 1;
  return {
    id: r.id,
    name: r.name,
    count: 0,
    total,
    pointsEarned: 0,
    requirement: total,
    pointsPerPurchase: r.pointsPerPurchase ?? 1,
    rewardType: (r.type === 'freebie' ? 'free_product' : 'other') as 'free_product' | 'discount' | 'other',
    businessId: r.businessId,
    businessName,
    selectedProducts: r.selectedProducts,
    selectedActions: r.selectedActions,
    qrCode: r.qrCode,
    pinCode: r.pinCode,
    createdAt: r.createdAt,
    lastScannedAt: r.updatedAt,
    isEarned: false,
  };
}

function mapCampaignToItem(c: RepoCampaign, businessName: string): CustomerRecordRewardItem {
  return {
    id: `campaign-${c.id}`,
    name: c.name,
    count: 0,
    total: 1,
    pointsEarned: 0,
    requirement: 1,
    businessId: c.businessId,
    businessName,
    startDate: c.startDate,
    endDate: c.endDate,
    isEarned: false,
  };
}

function buildClareRecord(repo: RepoData): CustomerRecord {
  const now = new Date().toISOString();
  const profile = repo.business?.profile;
  const businessName = repo.business?.name ?? 'The Stables';

  const rewardItems: CustomerRecordRewardItem[] = [];
  for (const r of repo.rewards ?? []) {
    rewardItems.push(mapRewardToItem(r, businessName));
  }
  for (const c of repo.campaigns ?? []) {
    rewardItems.push(mapCampaignToItem(c, businessName));
  }

  return {
    id: CLARE_ID,
    email: CLARE_EMAIL,
    firstName: 'Clare',
    lastName: 'Langley',
    phone: profile?.phone ?? '',
    createdAt: now,
    updatedAt: now,
    preferences: { notifications: true, marketing: false },
    totalStamps: 0,
    totalRedemptions: 0,
    rewards: rewardItems,
  };
}

const REDIS_URL_DEFAULT = 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

async function main() {
  const force = process.argv.includes('--force');
  const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL || REDIS_URL_DEFAULT;
  if (!redisUrl) {
    console.error('❌ REDIS_URL not set. Use .env or REDIS_URL=...');
    process.exit(1);
  }

  const repoPath = resolve(__dirname, '../app-repository-data.json');
  let repo: RepoData = { rewards: [], campaigns: [] };
  try {
    const raw = readFileSync(repoPath, 'utf8');
    repo = JSON.parse(raw) as RepoData;
  } catch (e) {
    console.warn('⚠️  Could not load app-repository-data.json, using empty rewards/campaigns:', (e as Error).message);
  }

  console.log('📡 Connecting to Redis...');
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 15000,
    commandTimeout: 30000,
    enableReadyCheck: false,
    enableOfflineQueue: true,
    retryStrategy: (t) => Math.min(t * 200, 3000),
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const done = () => { redis.removeListener('error', onErr); redis.removeListener('ready', onReady); };
      const onErr = (e: Error) => { done(); reject(e); };
      const onReady = () => { done(); resolve(); };
      redis.once('error', onErr);
      redis.once('ready', onReady);
    });
    await redis.ping();
    console.log('✅ Connected\n');

    const existing = await redis.get(REDIS_KEYS.customer(CLARE_ID));
    const emailKey = REDIS_KEYS.customerEmail(CLARE_EMAIL);
    const existingEmail = await redis.get(emailKey);

    if (!force && existing && existingEmail) {
      console.log('ℹ️  Customer record and email index already exist.');
      console.log(`   ${REDIS_KEYS.customer(CLARE_ID)}`);
      console.log(`   ${emailKey}`);
      const parsed = JSON.parse(existing) as CustomerRecord;
      console.log(`   rewards: ${parsed.rewards?.length ?? 0} items`);
      const authKey = REDIS_KEYS.customerAuthByEmail(CLARE_EMAIL);
      const existingAuth = await redis.get(authKey);
      if (!existingAuth) {
        const passwordHash = await bcrypt.hash(CLARE_DEFAULT_PASSWORD, 10);
        await redis.set(
          authKey,
          JSON.stringify({
            email: CLARE_EMAIL.toLowerCase(),
            passwordHash,
            customerId: CLARE_ID,
            createdAt: new Date().toISOString(),
          })
        );
        console.log(`✅ SET ${authKey} (login password: ${CLARE_DEFAULT_PASSWORD})`);
      } else {
        console.log(`ℹ️  Auth already exists: ${authKey}`);
      }
      console.log('✅ Done.');
      redis.disconnect();
      return;
    }

    const record = buildClareRecord(repo);

    await redis.set(REDIS_KEYS.customer(CLARE_ID), JSON.stringify(record));
    console.log(`✅ SET ${REDIS_KEYS.customer(CLARE_ID)}`);

    await redis.set(emailKey, JSON.stringify({ customerId: CLARE_ID }));
    console.log(`✅ SET ${emailKey} -> { "customerId": "${CLARE_ID}" }`);

    await redis.sadd(REDIS_KEYS.customersAll, CLARE_ID);
    console.log(`✅ SADD ${REDIS_KEYS.customersAll} "${CLARE_ID}"`);

    const authKey = REDIS_KEYS.customerAuthByEmail(CLARE_EMAIL);
    const existingAuth = await redis.get(authKey);
    if (force || !existingAuth) {
      const passwordHash = await bcrypt.hash(CLARE_DEFAULT_PASSWORD, 10);
      await redis.set(
        authKey,
        JSON.stringify({
          email: CLARE_EMAIL.toLowerCase(),
          passwordHash,
          customerId: CLARE_ID,
          createdAt: new Date().toISOString(),
        })
      );
      console.log(`✅ SET ${authKey} (login password: ${CLARE_DEFAULT_PASSWORD})`);
    } else {
      console.log(`ℹ️  Auth already exists: ${authKey}`);
    }

    console.log(`\n📋 Clare Langley (${CLARE_EMAIL}) id=${CLARE_ID}`);
    console.log(`   ${record.rewards.length} rewards/campaigns`);
    console.log('✅ Complete customer record seeded.');
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}

main();
