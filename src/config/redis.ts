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
  
  // Businesses
  business: (id: string) => `business:${id}`,
  businessBySlug: (slug: string) => `business:slug:${slug}`,
  businessMembers: (businessId: string) => `business:${businessId}:members`,
  businessAuthByEmail: (email: string) => `business:auth:${email.toLowerCase()}`,
  
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
  memberAchievements: (memberId: string) => `member:${memberId}:achievements`,
  memberRank: (memberId: string, type: string) => `member:${memberId}:rank:${type}`,
  
  // Notifications
  notification: (id: string) => `notification:${id}`,
  memberNotifications: (memberId: string) => `member:${memberId}:notifications`,
};

// Helper functions for common operations
export const redis = {
  // Member operations
  async getMember(id: string) {
    const data = await redisClient.get(REDIS_KEYS.member(id));
    return data ? JSON.parse(data) : null;
  },
  
  async setMember(id: string, member: any, expirySeconds?: number) {
    const key = REDIS_KEYS.member(id);
    if (expirySeconds) {
      await redisClient.setex(key, expirySeconds, JSON.stringify(member));
    } else {
      await redisClient.set(key, JSON.stringify(member));
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
  async addStamp(memberId: string, businessId: string, stampData: any) {
    const key = REDIS_KEYS.memberStamps(memberId, businessId);
    await redisClient.rpush(key, JSON.stringify({
      ...stampData,
      timestamp: new Date().toISOString(),
    }));
    return redisClient.llen(key);
  },
  
  async getStampCount(memberId: string, businessId: string) {
    const key = REDIS_KEYS.memberStamps(memberId, businessId);
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
