import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, REDIS_KEYS, redisClient } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { Business, ApiResponse } from '../types';
import { saveEntityCopy } from '../services/repositoryCopyService';
import { captureClientUpload, captureServerDownload } from '../services/debugCaptureService';
// ⚠️ TEMPORARY DEBUG: Redis write monitor - REMOVE BEFORE PRODUCTION
import { redisWriteMonitor } from '../middleware/redisWriteMonitor';

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
// API is transparent pipe - accepts whatever app sends, no validation, no requirements
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  // Accept full business object from client - API is a transparent forwarder
  // API has no role in data accuracy - forms/app UI mandate dataset
  const businessData = req.body;
  
  // Use provided ID if valid, otherwise generate new one
  const id = businessData.id && typeof businessData.id === 'string' && businessData.id.length > 0 
    ? businessData.id 
    : uuidv4();
  const slug = businessData.slug || (businessData.name ? createSlug(businessData.name) : `business-${id}`);
  const now = new Date().toISOString();
  
  // API is transparent pipe - store exactly what app sends
  const business: any = {
    ...businessData, // Include ALL fields from request
    id,
    slug,
    createdAt: businessData.createdAt || now,
    updatedAt: businessData.updatedAt || now,
  };
  
  // Store in Redis
  await redis.setBusiness(id, business);
  
  // Index by slug
  await redisClient.set(REDIS_KEYS.businessBySlug(slug), id);
  
  // Add to BID if specified
  if (businessData.bidId) {
    await redisClient.sadd(REDIS_KEYS.bidBusinesses(businessData.bidId), id);
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
  
  // Capture server download for debugging
  captureServerDownload('business', id, business).catch(err => 
    console.error('[DEBUG] Error capturing server download:', err)
  );
  
  const response: ApiResponse<Business> = {
    success: true,
    data: business,
  };
  
  res.json(response);
}));

// PUT /api/v1/businesses/:id - Update a business
// ⚠️ TEMPORARY: Monitor blocks unauthorized writes - REMOVE BEFORE PRODUCTION
router.put('/:id', redisWriteMonitor('business'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Capture client upload for debugging
  captureClientUpload('business', id, req.body).catch(err => 
    console.error('[DEBUG] Error capturing client upload:', err)
  );
  
  const existing = await redis.getBusiness(id);
  
  if (!existing) {
    throw new ApiError(404, 'Business not found');
  }
  
  // VALIDATION: Flag missing fields that should always be present in BusinessProfile
  const missingFields: string[] = [];
  if (existing.products !== undefined && updates.products === undefined) {
    missingFields.push('products');
    console.error(`❌ [BUSINESSES] DATA LOSS: Business ${id} missing 'products' field. Existing had ${Array.isArray(existing.products) ? existing.products.length : 0} products.`);
  }
  if (existing.actions !== undefined && updates.actions === undefined) {
    missingFields.push('actions');
    console.error(`❌ [BUSINESSES] DATA LOSS: Business ${id} missing 'actions' field. Existing had ${Array.isArray(existing.actions) ? existing.actions.length : 0} actions.`);
  }
  if (existing.profile?.products !== undefined && updates.profile?.products === undefined && !updates.products) {
    missingFields.push('profile.products');
    console.error(`❌ [BUSINESSES] DATA LOSS: Business ${id} missing 'profile.products' field.`);
  }
  if (existing.profile?.actions !== undefined && updates.profile?.actions === undefined && !updates.actions) {
    missingFields.push('profile.actions');
    console.error(`❌ [BUSINESSES] DATA LOSS: Business ${id} missing 'profile.actions' field.`);
  }
  if (missingFields.length > 0) {
    console.error(`❌ [BUSINESSES] CRITICAL: Missing fields that existed before: ${missingFields.join(', ')}`);
    console.error(`❌ [BUSINESSES] This indicates data loss - app should send complete BusinessProfile with products/actions`);
  }
  
  // API is a transparent pipe - store exactly what app sends (full replacement)
  // App must send complete business record
  // CRITICAL: Do NOT merge - full replacement only
  const updated: Business = {
    ...updates, // Store exactly what app sends (complete record)
    id, // Ensure ID can't be changed
    updatedAt: updates.updatedAt !== undefined ? updates.updatedAt : existing.updatedAt, // Preserve timestamp if not provided
  };
  
  await redis.setBusiness(id, updated);
  
  // Capture what was saved to Redis for debugging
  captureClientUpload('business', id, updated).catch(err => 
    console.error('[DEBUG] Error capturing saved business:', err)
  );
  
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

// GET /api/v1/businesses/:id/customers - Get business's customers
router.get('/:id/customers', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  
  const business = await redis.getBusiness(id);
  
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  // Get customer IDs from the set
  const customerIds = await redisClient.smembers(REDIS_KEYS.businessCustomers(id));
  
  // Fetch customer details (with pagination)
  const start = (page - 1) * limit;
  const paginatedIds = customerIds.slice(start, start + limit);
  
  const customers = await Promise.all(
    paginatedIds.map(async (customerId) => {
      const customer = await redis.getCustomer(customerId);
      const stampCount = await redis.getStampCount(customerId, id);
      return { ...customer, stampCount };
    })
  );
  
  res.json({
    success: true,
    data: customers.filter(Boolean),
    meta: { page, limit, total: customerIds.length },
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
      newCustomersThisWeek: 0,
      stampsThisWeek: 0,
      redemptionsThisWeek: 0,
      topReward: null,
    },
  });
}));

export default router;

