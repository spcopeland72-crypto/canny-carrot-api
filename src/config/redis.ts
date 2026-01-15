import Redis from 'ioredis';
import { config } from './env';

// Create Redis client with serverless-optimized settings
const isVercel = process.env.VERCEL === '1';
export const redisClient = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
  // Serverless-optimized settings
  connectTimeout: 10000, // 10 seconds
  commandTimeout: 5000, // 5 seconds
  enableReadyCheck: false, // Skip ready check to avoid timeout issues
  enableOfflineQueue: false, // Don't queue commands when offline
  keepAlive: 30000, // 30 seconds keepalive
  // For Vercel: don't auto-reconnect aggressively (serverless functions are ephemeral)
  ...(isVercel ? {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1, // Faster failures on Vercel
  } : {}),
});

// Track connection state
let connectionPromise: Promise<void> | null = null;
let isConnected = false;

// Connection handler - lazy connection for serverless
export const connectRedis = async (): Promise<void> => {
  // If already connected, return immediately
  if (isConnected && redisClient.status === 'ready') {
    return Promise.resolve();
  }
  
  // If already connecting, return existing promise
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      connectionPromise = null;
      reject(new Error('Redis connection timeout after 10 seconds'));
    }, 10000);

    const onConnect = () => {
      console.log('📡 Connecting to Redis...');
    };

    const onReady = () => {
      clearTimeout(timeout);
      isConnected = true;
      console.log('✅ Redis connection ready');
      cleanup();
      resolve();
    };

    const onError = (err: Error) => {
      clearTimeout(timeout);
      connectionPromise = null;
      isConnected = false;
      console.error('❌ Redis connection error:', err.message);
      cleanup();
      if (config.nodeEnv === 'development') {
        console.log('💡 Running without Redis - using in-memory fallback');
        resolve(); // Don't fail in dev mode
      } else {
        reject(err);
      }
    };

    const cleanup = () => {
      redisClient.removeListener('connect', onConnect);
      redisClient.removeListener('ready', onReady);
      redisClient.removeListener('error', onError);
    };

    redisClient.once('connect', onConnect);
    redisClient.once('ready', onReady);
    redisClient.once('error', onError);

    // Only connect if not already connecting/connected
    const status = redisClient.status;
    if (status === 'end' || status === 'close' || status === 'wait') {
      redisClient.connect().catch((err) => {
        clearTimeout(timeout);
        connectionPromise = null;
        cleanup();
        if (config.nodeEnv === 'development') {
          console.log('⚠️ Redis not available - running in dev mode with fallback');
          resolve();
        } else {
          reject(err);
        }
      });
    } else if (status === 'ready') {
      clearTimeout(timeout);
      isConnected = true;
      cleanup();
      resolve();
    } else {
      // Already connecting
      console.log('⏳ Redis connection in progress...');
    }
  });

  return connectionPromise;
};

// Redis key prefixes for organization
export const REDIS_KEYS = {
  // Members (customers using the app)
  member: (id: string) => `member:${id}`,
  memberByEmail: (email: string) => `member:email:${email}`,
  memberByPhone: (phone: string) => `member:phone:${phone}`,
  memberStamps: (memberId: string, businessId: string) => `member:${memberId}:stamps:${businessId}`,
  
  // Customers (alias for members)
  customer: (id: string) => `customer:${id}`,
  customerByEmail: (email: string) => `customer:email:${email}`,
  customerByPhone: (phone: string) => `customer:phone:${phone}`,
  customerStamps: (customerId: string, businessId: string) => `customer:${customerId}:stamps:${businessId}`,
  businessCustomers: (businessId: string) => `business:${businessId}:customers`,
  
  // Businesses
  business: (id: string) => `business:${id}`,
  businessBySlug: (slug: string) => `business:slug:${slug}`,
  businessMembers: (businessId: string) => `business:${businessId}:members`,
  businessAuthByEmail: (email: string) => `business:auth:${email.toLowerCase()}`,
  businessDevices: (businessId: string) => `business:${businessId}:devices`,
  
  // Rewards
  reward: (id: string) => `reward:${id}`,
  businessRewards: (businessId: string) => `business:${businessId}:rewards`,
  
  // Stamps & Redemptions
  stamp: (id: string) => `stamp:${id}`,
  redemption: (id: string) => `redemption:${id}`,
  
  // BID (Business Improvement District) aggregates
  bidBusinesses: (bidId: string) => `bid:${bidId}:businesses`,
  bidStats: (bidId: string) => `bid:${bidId}:stats`,
  
  // Regional analytics
  regionStats: (region: string) => `region:${region}:stats`,
  dailyStats: (date: string) => `stats:daily:${date}`,
  
  // Sessions
  session: (token: string) => `session:${token}`,
  
  // Campaigns
  campaign: (id: string) => `campaign:${id}`,
  businessCampaigns: (businessId: string) => `business:${businessId}:campaigns`,
  
  // Gamification & Leaderboards
  leaderboard: (type: 'stamps' | 'redemptions' | 'points' | 'referrals') => `leaderboard:${type}`,
  customerAchievements: (customerId: string) => `customer:${customerId}:achievements`,
  customerRank: (customerId: string, type: string) => `customer:${customerId}:rank:${type}`,
  
  // Notifications
  notification: (id: string) => `notification:${id}`,
  customerNotifications: (customerId: string) => `customer:${customerId}:notifications`,
};

// Helper functions for common operations
export const redis = {
  // Customer operations
  async getCustomer(id: string) {
    const data = await redisClient.get(REDIS_KEYS.customer(id));
    return data ? JSON.parse(data) : null;
  },
  
  async setCustomer(id: string, customer: any, expirySeconds?: number) {
    const key = REDIS_KEYS.customer(id);
    if (expirySeconds) {
      await redisClient.setex(key, expirySeconds, JSON.stringify(customer));
    } else {
      await redisClient.set(key, JSON.stringify(customer));
    }
  },
  
  // Member operations (alias for customer - for backward compatibility)
  async getMember(id: string) {
    // Try customer first, then member for backward compatibility
    let data = await redisClient.get(REDIS_KEYS.customer(id));
    if (!data) {
      data = await redisClient.get(REDIS_KEYS.member(id));
    }
    return data ? JSON.parse(data) : null;
  },
  
  async setMember(id: string, member: any, expirySeconds?: number) {
    // Store as both customer and member for backward compatibility
    const customerKey = REDIS_KEYS.customer(id);
    const memberKey = REDIS_KEYS.member(id);
    const jsonValue = JSON.stringify(member);
    if (expirySeconds) {
      await redisClient.setex(customerKey, expirySeconds, jsonValue);
      await redisClient.setex(memberKey, expirySeconds, jsonValue);
    } else {
      await redisClient.set(customerKey, jsonValue);
      await redisClient.set(memberKey, jsonValue);
    }
  },
  
  // Business operations
  async getBusiness(id: string) {
    const data = await redisClient.get(REDIS_KEYS.business(id));
    return data ? JSON.parse(data) : null;
  },
  
  async setBusiness(id: string, business: any) {
    await redisClient.set(REDIS_KEYS.business(id), JSON.stringify(business));
  },
  
  // Stamp tracking
  async addStamp(customerId: string, businessId: string, stampData: any) {
    const key = REDIS_KEYS.customerStamps(customerId, businessId);
    await redisClient.rpush(key, JSON.stringify({
      ...stampData,
      timestamp: new Date().toISOString(),
    }));
    return redisClient.llen(key);
  },
  
  async getStampCount(customerId: string, businessId: string) {
    const key = REDIS_KEYS.customerStamps(customerId, businessId);
    return redisClient.llen(key);
  },
  
  // Analytics increment
  async incrementStat(key: string, field: string, amount: number = 1) {
    return redisClient.hincrby(key, field, amount);
  },
  
  // BID stats aggregation
  async getBidStats(bidId: string) {
    const key = REDIS_KEYS.bidStats(bidId);
    return redisClient.hgetall(key);
  },
};

export default redisClient;
