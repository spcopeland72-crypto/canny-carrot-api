/**
 * Customer record API adapter
 *
 * Read/write CustomerRecord (account + rewards) to Redis.
 * Use for GET by id/email, PUT sync, and seed.
 * Maintains token-link indexes so customer/business queries are O(sets) not O(scan):
 * - customer:{id}:businesses, customer:{id}:tokens
 * - business:{businessId}:customers
 * - token:{tokenId}:customers
 * API is pure pass-through: do not touch updatedAt — store exactly what the client sent.
 */

import { redis, redisClient, REDIS_KEYS } from '../config/redis';
import type { CustomerRecord } from '../types/customerRecord';

type RewardItem = { id?: string; businessId?: string; businessName?: string };

/** Token-link index: token id = document id for both rewards and campaigns. Same format everywhere. */
function getBusinessIdsAndTokenIds(rewards: RewardItem[]): { businessIds: Set<string>; tokenIds: Set<string> } {
  const businessIds = new Set<string>();
  const tokenIds = new Set<string>();
  for (const r of rewards) {
    const tid = (r.id ?? '').toString().trim();
    const rawBid = (r.businessId ?? '').toString().trim();
    const rawBName = (r.businessName ?? '').toString().trim();
    const bid = rawBName && rawBName.startsWith('business_') ? rawBName : rawBid;
    if (bid) businessIds.add(bid);
    if (tid) tokenIds.add(tid);
  }
  return { businessIds, tokenIds };
}

export const customerRecordService = {
  /** Get full customer record by id. Returns null if not found. */
  async getById(id: string): Promise<CustomerRecord | null> {
    const data = await redis.getCustomer(id);
    if (!data) return null;
    const rec = data as Record<string, unknown>;
    const rewards = Array.isArray(rec.rewards) ? rec.rewards : [];
    return { ...rec, rewards } as CustomerRecord;
  },

  /** Resolve by email, then load full record. Returns null if not found. */
  async getByEmail(email: string): Promise<CustomerRecord | null> {
    const id = await redis.getCustomerIdByEmail(email);
    if (!id) return null;
    return customerRecordService.getById(id);
  },

  /**
   * Full replace: store record at customer:{id}, update email index, then rebuild token-link indexes.
   * Removes customer from old business/token sets and adds to new so indexes stay accurate.
   */
  async replace(id: string, record: CustomerRecord): Promise<void> {
    const existing = await redis.getCustomer(id);
    const oldRewards = Array.isArray((existing as { rewards?: RewardItem[] })?.rewards)
      ? (existing as { rewards: RewardItem[] }).rewards
      : [];
    const newRewards = Array.isArray(record.rewards) ? (record.rewards as RewardItem[]) : [];

    const doc = { ...record, id };
    await redis.setCustomer(id, doc);
    const email = (record.email ?? '').toString().toLowerCase().trim();
    if (email) await redis.setCustomerEmailIndex(email, id);

    const { businessIds: oldBids, tokenIds: oldTids } = getBusinessIdsAndTokenIds(oldRewards);
    const { businessIds: newBids, tokenIds: newTids } = getBusinessIdsAndTokenIds(newRewards);

    for (const bid of oldBids) {
      await redisClient.srem(REDIS_KEYS.businessCustomers(bid), id);
    }
    for (const bid of newBids) {
      await redisClient.sadd(REDIS_KEYS.businessCustomers(bid), id);
    }
    for (const tid of oldTids) {
      await redisClient.srem(REDIS_KEYS.tokenCustomers(tid), id);
    }
    for (const tid of newTids) {
      await redisClient.sadd(REDIS_KEYS.tokenCustomers(tid), id);
    }

    await redisClient.del(REDIS_KEYS.customerBusinesses(id));
    await redisClient.del(REDIS_KEYS.customerTokens(id));
    for (const bid of newBids) {
      await redisClient.sadd(REDIS_KEYS.customerBusinesses(id), bid);
    }
    for (const tid of newTids) {
      await redisClient.sadd(REDIS_KEYS.customerTokens(id), tid);
    }
  },
};
