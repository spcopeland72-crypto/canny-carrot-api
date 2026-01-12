import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, REDIS_KEYS, redisClient } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { Business, ApiResponse } from '../types';
import { saveEntityCopy } from '../services/repositoryCopyService';

const router = Router();

// Helper to create URL-friendly slug
const createSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

// GET /api/v1/businesses - List all businesses
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { city, category, bidId } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  
  // TODO: Implement proper filtering with Redis
  // For now, return placeholder
  const response: ApiResponse<Business[]> = {
    success: true,
    data: [],
    meta: { page, limit, total: 0 },
  };
  
  res.json(response);
}));

// POST /api/v1/businesses - Register a new business
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, address, category, bidId, logo, description } = req.body;
  
  if (!name || !email || !address) {
    throw new ApiError(400, 'Name, email, and address are required');
  }
  
  // Validate address is in Tees Valley
  const validCities = ['middlesbrough', 'stockton', 'stockton-on-tees', 'darlington', 'hartlepool', 'redcar'];
  const cityLower = address.city?.toLowerCase();
  if (!validCities.some(c => cityLower?.includes(c))) {
    // Warning but don't block - might expand later
    console.warn(`Business ${name} registered outside core Tees Valley area: ${address.city}`);
  }
  
  const id = uuidv4();
  const slug = createSlug(name);
  const now = new Date().toISOString();
  
  const business: Business = {
    id,
    name,
    slug,
    email: email.toLowerCase(),
    phone,
    address: {
      ...address,
      region: 'tees-valley',
    },
    category: category || 'other',
    bidId,
    status: 'active',
    logo,
    description,
    createdAt: now,
    updatedAt: now,
    settings: {
      stampValidationMethod: 'qr',
      autoRewardEnabled: true,
      notificationsEnabled: true,
    },
    stats: {
      totalMembers: 0,
      totalStampsIssued: 0,
      totalRedemptions: 0,
      activeRewards: 0,
    },
  };
  
  // Store in Redis
  await redis.setBusiness(id, business);
  
  // Index by slug
  await redisClient.set(REDIS_KEYS.businessBySlug(slug), id);
  
  // Add to BID if specified
  if (bidId) {
    await redisClient.sadd(REDIS_KEYS.bidBusinesses(bidId), id);
  }
  
  const response: ApiResponse<Business> = {
    success: true,
    data: business,
  };
  
  res.status(201).json(response);
}));

// GET /api/v1/businesses/:id - Get a specific business
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Try by ID first, then by slug
  let business = await redis.getBusiness(id);
  
  if (!business) {
    // Try looking up by slug
    const businessId = await redisClient.get(REDIS_KEYS.businessBySlug(id));
    if (businessId) {
      business = await redis.getBusiness(businessId);
    }
  }
  
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  const response: ApiResponse<Business> = {
    success: true,
    data: business,
  };
  
  res.json(response);
}));

// PUT /api/v1/businesses/:id - Update a business
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = await redis.getBusiness(id);
  
  if (!existing) {
    throw new ApiError(404, 'Business not found');
  }
  
  // CRITICAL: Do NOT update updatedAt - Redis timestamps should only change when admin makes changes
  // API is a transparent forwarder - preserve existing updatedAt unless explicitly provided
  const updated: Business = {
    ...existing,
    ...updates,
    id, // Ensure ID can't be changed
    updatedAt: updates.updatedAt !== undefined ? updates.updatedAt : existing.updatedAt, // Only update if explicitly provided
  };
  
  await redis.setBusiness(id, updated);
  
  // Save repository copy when business profile is updated
  saveEntityCopy(id, 'business').catch(err => {
    console.error('[BUSINESSES] Error saving repository copy:', err);
  });
  
  const response: ApiResponse<Business> = {
    success: true,
    data: updated,
  };
  
  res.json(response);
}));

// GET /api/v1/businesses/:id/members - Get business's members
router.get('/:id/members', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  
  const business = await redis.getBusiness(id);
  
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  // Get member IDs from the set
  const memberIds = await redisClient.smembers(REDIS_KEYS.businessMembers(id));
  
  // Fetch member details (with pagination)
  const start = (page - 1) * limit;
  const paginatedIds = memberIds.slice(start, start + limit);
  
  const members = await Promise.all(
    paginatedIds.map(async (memberId) => {
      const member = await redis.getMember(memberId);
      const stampCount = await redis.getStampCount(memberId, id);
      return { ...member, stampCount };
    })
  );
  
  res.json({
    success: true,
    data: members.filter(Boolean),
    meta: { page, limit, total: memberIds.length },
  });
}));

// GET /api/v1/businesses/:id/stats - Get business statistics
router.get('/:id/stats', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { period = 'month' } = req.query;
  
  const business = await redis.getBusiness(id);
  
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  // Return stats (would be computed from Redis in production)
  res.json({
    success: true,
    data: {
      businessId: id,
      period,
      ...business.stats,
      // Additional computed stats would go here
      newMembersThisWeek: 0,
      stampsThisWeek: 0,
      redemptionsThisWeek: 0,
      topReward: null,
    },
  });
}));

export default router;

