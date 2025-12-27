import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, REDIS_KEYS, redisClient } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { Stamp, Redemption, ApiResponse } from '../types';

const router = Router();

// POST /api/v1/stamps - Issue a stamp (QR code scanned)
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { memberId, businessId, rewardId, method = 'qr', staffId } = req.body;
  
  if (!memberId || !businessId) {
    throw new ApiError(400, 'Member ID and Business ID are required');
  }
  
  // Verify member exists
  const member = await redis.getMember(memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  // Verify business exists
  const business = await redis.getBusiness(businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const stamp: Stamp = {
    id,
    memberId,
    businessId,
    rewardId: rewardId || '',
    issuedAt: now,
    issuedBy: staffId || 'system',
    method,
  };
  
  // Store stamp
  await redisClient.set(REDIS_KEYS.stamp(id), JSON.stringify(stamp));
  
  // Add to member's stamp list for this business
  const stampCount = await redis.addStamp(memberId, businessId, stamp);
  
  // Add member to business's member set
  await redisClient.sadd(REDIS_KEYS.businessMembers(businessId), memberId);
  
  // Update business stats
  const updatedBusiness = {
    ...business,
    stats: {
      ...business.stats,
      totalStampsIssued: (business.stats.totalStampsIssued || 0) + 1,
    },
    updatedAt: now,
  };
  await redis.setBusiness(businessId, updatedBusiness);
  
  // Update daily stats for analytics
  const today = new Date().toISOString().split('T')[0];
  await redis.incrementStat(REDIS_KEYS.dailyStats(today), 'stamps', 1);
  await redis.incrementStat(REDIS_KEYS.dailyStats(today), `stamps:${businessId}`, 1);
  
  // Check if reward threshold reached
  let rewardAvailable = false;
  let reward = null;
  
  if (rewardId) {
    const rewardData = await redisClient.get(REDIS_KEYS.reward(rewardId));
    if (rewardData) {
      reward = JSON.parse(rewardData);
      if (stampCount >= reward.stampsRequired) {
        rewardAvailable = true;
      }
    }
  }
  
  res.status(201).json({
    success: true,
    data: {
      stamp,
      currentStampCount: stampCount,
      rewardAvailable,
      reward: rewardAvailable ? reward : null,
    },
  });
}));

// POST /api/v1/stamps/redeem - Redeem a reward
router.post('/redeem', asyncHandler(async (req: Request, res: Response) => {
  const { memberId, businessId, rewardId, staffId } = req.body;
  
  if (!memberId || !businessId || !rewardId) {
    throw new ApiError(400, 'Member ID, Business ID, and Reward ID are required');
  }
  
  // Verify member
  const member = await redis.getMember(memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  // Verify business
  const business = await redis.getBusiness(businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  // Verify reward
  const rewardData = await redisClient.get(REDIS_KEYS.reward(rewardId));
  if (!rewardData) {
    throw new ApiError(404, 'Reward not found');
  }
  
  const reward = JSON.parse(rewardData);
  
  if (!reward.isActive) {
    throw new ApiError(400, 'This reward is no longer active');
  }
  
  // Check stamp count
  const stampCount = await redis.getStampCount(memberId, businessId);
  
  if (stampCount < reward.stampsRequired) {
    throw new ApiError(400, `Not enough stamps. Need ${reward.stampsRequired}, have ${stampCount}`);
  }
  
  // Check max redemptions
  if (reward.maxRedemptions && reward.currentRedemptions >= reward.maxRedemptions) {
    throw new ApiError(400, 'This reward has reached its maximum redemptions');
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const redemption: Redemption = {
    id,
    memberId,
    businessId,
    rewardId,
    redeemedAt: now,
    verifiedBy: staffId,
    status: 'completed',
  };
  
  // Store redemption
  await redisClient.set(REDIS_KEYS.redemption(id), JSON.stringify(redemption));
  
  // Reset member's stamps for this business (or deduct the required amount)
  const key = REDIS_KEYS.memberStamps(memberId, businessId);
  // Remove the stamps used for this reward
  for (let i = 0; i < reward.stampsRequired; i++) {
    await redisClient.lpop(key);
  }
  
  // Update reward redemption count
  const updatedReward = {
    ...reward,
    currentRedemptions: (reward.currentRedemptions || 0) + 1,
  };
  await redisClient.set(REDIS_KEYS.reward(rewardId), JSON.stringify(updatedReward));
  
  // Update business stats
  const updatedBusiness = {
    ...business,
    stats: {
      ...business.stats,
      totalRedemptions: (business.stats.totalRedemptions || 0) + 1,
    },
    updatedAt: now,
  };
  await redis.setBusiness(businessId, updatedBusiness);
  
  // Update member stats
  await redis.setMember(memberId, {
    ...member,
    totalRedemptions: (member.totalRedemptions || 0) + 1,
    updatedAt: now,
  });
  
  // Update daily stats
  const today = new Date().toISOString().split('T')[0];
  await redis.incrementStat(REDIS_KEYS.dailyStats(today), 'redemptions', 1);
  
  const newStampCount = await redis.getStampCount(memberId, businessId);
  
  res.status(201).json({
    success: true,
    data: {
      redemption,
      reward,
      newStampCount,
      message: `Successfully redeemed: ${reward.name}`,
    },
  });
}));

// GET /api/v1/stamps/check - Check stamp count for member at business
router.get('/check', asyncHandler(async (req: Request, res: Response) => {
  const { memberId, businessId } = req.query;
  
  if (!memberId || !businessId) {
    throw new ApiError(400, 'Member ID and Business ID are required');
  }
  
  const stampCount = await redis.getStampCount(memberId as string, businessId as string);
  
  // Get active rewards for this business
  const rewardIds = await redisClient.smembers(REDIS_KEYS.businessRewards(businessId as string));
  
  const rewards = await Promise.all(
    rewardIds.map(async (id) => {
      const data = await redisClient.get(REDIS_KEYS.reward(id));
      return data ? JSON.parse(data) : null;
    })
  );
  
  const activeRewards = rewards.filter(r => r && r.isActive);
  
  // Check which rewards are available
  const availableRewards = activeRewards.filter(r => stampCount >= r.stampsRequired);
  const nextReward = activeRewards
    .filter(r => stampCount < r.stampsRequired)
    .sort((a, b) => a.stampsRequired - b.stampsRequired)[0];
  
  res.json({
    success: true,
    data: {
      memberId,
      businessId,
      stampCount,
      availableRewards,
      nextReward,
      stampsUntilNextReward: nextReward ? nextReward.stampsRequired - stampCount : null,
    },
  });
}));

export default router;


















