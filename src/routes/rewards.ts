import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, REDIS_KEYS, redisClient } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { Reward, ApiResponse } from '../types';
import { saveEntityCopy } from '../services/repositoryCopyService';
import { captureClientUpload, captureServerDownload } from '../services/debugCaptureService';

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
    
    // Capture server download for debugging
    captureServerDownload('rewards', businessId as string, filteredRewards).catch(err => 
      console.error('[DEBUG] Error capturing server download:', err)
    );
    
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
  // Accept full reward object from client - API is a transparent forwarder
  const { id, businessId, name, stampsRequired } = req.body;
  
  // Capture client upload for debugging
  if (businessId) {
    captureClientUpload('reward', businessId, req.body).catch(err => 
      console.error('[DEBUG] Error capturing client upload:', err)
    );
  }
  
  console.log('\n🥕 ============================================');
  console.log('🥕 REWARD CREATION REQUEST');
  console.log('🥕 ============================================');
  console.log('📋 Reward Name:', name);
  console.log('📋 Business ID:', businessId);
  console.log('📋 Reward ID:', id);
  console.log('📋 Stamps Required:', stampsRequired);
  console.log('🥕 ============================================\n');
  
  if (!businessId || !name || !stampsRequired) {
    console.error('❌ [REWARDS] Missing required fields:', { businessId: !!businessId, name: !!name, stampsRequired: !!stampsRequired });
    throw new ApiError(400, 'Business ID, name, and stamps required are mandatory');
  }
  
  // Verify business exists
  const business = await redis.getBusiness(businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  // Use provided ID if valid, otherwise generate new one
  // This allows app to sync rewards with existing IDs
  const rewardId = id && typeof id === 'string' && id.length > 0 ? id : uuidv4();
  const now = new Date().toISOString();
  
  // Check if reward with this ID already exists (for idempotency)
  const existingRewardData = await redisClient.get(REDIS_KEYS.reward(rewardId));
  if (existingRewardData) {
    // Reward exists - API is transparent pipe, store exactly what app sends (full replacement)
    // App must send complete reward record
    const reward: any = {
      ...req.body, // Include ALL fields from request (complete record)
      id: rewardId, // Ensure ID can't be changed
      businessId: existingRewardData ? JSON.parse(existingRewardData).businessId : businessId, // Preserve businessId
      createdAt: req.body.createdAt || JSON.parse(existingRewardData).createdAt || now, // Preserve or use provided
      updatedAt: req.body.updatedAt || now, // Use provided or current time
    };
    
    await redisClient.set(REDIS_KEYS.reward(rewardId), JSON.stringify(reward));
    
    // Ensure it's in the business rewards set
    await redisClient.sadd(REDIS_KEYS.businessRewards(businessId), rewardId);
    
    // API is a transparent forwarder - does not modify business.updatedAt
    // App is responsible for updating business profile timestamp when syncing
    
    // Save repository copy when reward is updated
    saveEntityCopy(businessId, 'reward', rewardId).catch(err => {
      console.error('[REWARDS] Error saving repository copy:', err);
    });
    
    return res.json({
      success: true,
      data: reward,
    });
  }
  
  // API is a transparent forwarder - use request body as-is, only set defaults for required fields
  // Do NOT auto-update timestamps - app manages timestamps
  const reward: any = {
    ...req.body, // Include ALL fields from request (selectedProducts, pinCode, qrCode, timestamps, etc.)
    id: rewardId,
    businessId,
    createdAt: req.body.createdAt || now, // Only set if not provided
    updatedAt: req.body.updatedAt || now, // Only set if not provided
    currentRedemptions: req.body.currentRedemptions !== undefined ? req.body.currentRedemptions : 0,
    isActive: req.body.isActive !== undefined ? req.body.isActive : true,
  };
  
    // Store reward
    await redisClient.set(REDIS_KEYS.reward(rewardId), JSON.stringify(reward));
    
    // Capture what was saved to Redis for debugging
    captureClientUpload('reward', businessId, reward).catch(err => 
      console.error('[DEBUG] Error capturing saved reward:', err)
    );
    
    // Add to business's reward set
    await redisClient.sadd(REDIS_KEYS.businessRewards(businessId), rewardId);
  
    // API is a transparent forwarder - does not modify business stats or timestamps
    // App is responsible for updating business profile and stats when syncing
    
    // Save repository copy when reward is created
    saveEntityCopy(businessId, 'reward', rewardId).catch(err => {
      console.error('[REWARDS] Error saving repository copy:', err);
    });
    
    const response: ApiResponse<any> = {
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
  
  // Capture client upload for debugging
  const data = await redisClient.get(REDIS_KEYS.reward(id));
  if (data) {
    const existing = JSON.parse(data);
    captureClientUpload('reward', existing.businessId, req.body).catch(err => 
      console.error('[DEBUG] Error capturing client upload:', err)
    );
  }
  
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
  
  // Capture what was saved to Redis for debugging
  captureClientUpload('reward', existing.businessId, updated).catch(err => 
    console.error('[DEBUG] Error capturing saved reward:', err)
  );
  
  // Save repository copy when reward is updated via PUT
  saveEntityCopy(existing.businessId, 'reward', id).catch(err => {
    console.error('[REWARDS] Error saving repository copy:', err);
  });
  
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

