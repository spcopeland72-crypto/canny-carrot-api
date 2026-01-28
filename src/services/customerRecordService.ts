/**
 * Customer record API adapter
 *
 * Read/write CustomerRecord (account + rewards) to Redis.
 * Use for GET by id/email, PUT sync, and seed.
 */

import { redis } from '../config/redis';
import type { CustomerRecord } from '../types/customerRecord';

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
   * Full replace: store record at customer:{id}, update email index.
   * Use for sync (app → Redis) and seed.
   */
  async replace(id: string, record: CustomerRecord): Promise<void> {
    const doc = { ...record, id, updatedAt: new Date().toISOString() };
    await redis.setCustomer(id, doc);
    const email = (record.email ?? '').toString().toLowerCase().trim();
    if (email) await redis.setCustomerEmailIndex(email, id);
  },
};
