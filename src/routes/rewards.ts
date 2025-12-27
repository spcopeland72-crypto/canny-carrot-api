import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, REDIS_KEYS, redisClient } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { Reward, ApiResponse } from '../types';

const router = Router();

// GET /api/v1/rewards - List rewards (optionally filtered by business)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { businessId, active } = req.query;
  
  if (businessId) {
    // Get rewards for a specific business
    const rewardIds = await redisClient.smembers(REDIS_KEYS.businessRewards(businessId as string));
    
    const rewards = await Promise.all(
      rewardIds.map(async (id) => {
        const data = await redisClient.get(REDIS_KEYS.reward(id));
        return data ? JSON.parse(data) : null;
      })
    );
    
    let filteredRewards = rewards.filter(Boolean);
    
    if (active === 'true') {
      filteredRewards = filteredRewards.filter((r: Reward) => r.isActive);
    }
    
    return res.json({
      success: true,
      data: filteredRewards,
    });
  }
  
  res.json({
    success: true,
    data: [],
  });
}));

// POST /api/v1/rewards - Create a new reward
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { businessId, name, description, stampsRequired, type, value, expiresAt, maxRedemptions } = req.body;
  
  if (!businessId || !name || !stampsRequired) {
    throw new ApiError(400, 'Business ID, name, and stamps required are mandatory');
  }
  
  // Verify business exists
  const business = await redis.getBusiness(businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const reward: Reward = {
    id,
    businessId,
    name,
    description: description || '',
    stampsRequired,
    costStamps: stampsRequired,  // Map to new field
    type: type || 'freebie',
    value,
    isActive: true,
    validFrom: now,
    validTo: expiresAt,
    expiresAt,  // Keep for backward compatibility
    createdAt: now,
    updatedAt: now,
    maxRedemptions,
    currentRedemptions: 0,
  };
  
  // Store reward
  await redisClient.set(REDIS_KEYS.reward(id), JSON.stringify(reward));
  
  // Add to business's reward set
  await redisClient.sadd(REDIS_KEYS.businessRewards(businessId), id);
  
  // Update business stats
  const updatedBusiness = {
    ...business,
    stats: {
      ...business.stats,
      activeRewards: (business.stats.activeRewards || 0) + 1,
    },
    updatedAt: now,
  };
  await redis.setBusiness(businessId, updatedBusiness);
  
  const response: ApiResponse<Reward> = {
    success: true,
    data: reward,
  };
  
  res.status(201).json(response);
}));

// GET /api/v1/rewards/:id - Get a specific reward
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const data = await redisClient.get(REDIS_KEYS.reward(id));
  
  if (!data) {
    throw new ApiError(404, 'Reward not found');
  }
  
  const reward = JSON.parse(data);
  
  const response: ApiResponse<Reward> = {
    success: true,
    data: reward,
  };
  
  res.json(response);
}));

// PUT /api/v1/rewards/:id - Update a reward
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  const data = await redisClient.get(REDIS_KEYS.reward(id));
  
  if (!data) {
    throw new ApiError(404, 'Reward not found');
  }
  
  const existing = JSON.parse(data);
  
  const updated: Reward = {
    ...existing,
    ...updates,
    id, // Ensure ID can't be changed
    businessId: existing.businessId, // Ensure business can't be changed
  };
  
  await redisClient.set(REDIS_KEYS.reward(id), JSON.stringify(updated));
  
  const response: ApiResponse<Reward> = {
    success: true,
    data: updated,
  };
  
  res.json(response);
}));

// DELETE /api/v1/rewards/:id - Deactivate a reward
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const data = await redisClient.get(REDIS_KEYS.reward(id));
  
  if (!data) {
    throw new ApiError(404, 'Reward not found');
  }
  
  const reward = JSON.parse(data);
  
  // Soft delete - just mark as inactive
  const updated = { ...reward, isActive: false };
  await redisClient.set(REDIS_KEYS.reward(id), JSON.stringify(updated));
  
  res.json({
    success: true,
    message: 'Reward deactivated',
  });
}));

export default router;

