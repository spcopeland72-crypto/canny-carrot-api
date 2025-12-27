import Redis from 'ioredis';
import { config } from './env';

// Create Redis client
export const redisClient = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
});

// Connection handler
export const connectRedis = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    redisClient.on('connect', () => {
      console.log('📡 Connecting to Redis...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis connection ready');
      resolve();
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
      if (config.nodeEnv === 'development') {
        console.log('💡 Running without Redis - using in-memory fallback');
        resolve(); // Don't fail in dev mode
      } else {
        reject(err);
      }
    });

    redisClient.connect().catch((err) => {
      if (config.nodeEnv === 'development') {
        console.log('⚠️ Redis not available - running in dev mode with fallback');
        resolve();
      } else {
        reject(err);
      }
    });
  });
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

