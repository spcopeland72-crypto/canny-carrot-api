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

// GET /api/v1/businesses/:id/tokens - Token-link index: reward + campaign UUIDs for this business
router.get('/:id/tokens', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const business = await redis.getBusiness(id);
  if (!business) throw new ApiError(404, 'Business not found');
  const [rewardIds, campaignIds] = await Promise.all([
    redisClient.smembers(REDIS_KEYS.businessRewards(id)),
    redisClient.smembers(REDIS_KEYS.businessCampaigns(id)),
  ]);
  const tokenIds = [...new Set([...rewardIds, ...campaignIds])];
  res.json({ success: true, data: { tokenIds } });
}));

/** Compute lastScanAt, scansLast30, scansLast90, totalScans from transactionLog for a token (reward/campaign) and business */
function scanAnalytics(
  transactionLog: { timestamp: string; action: string; data: Record<string, unknown> }[] | undefined,
  tokenId: string,
  businessId: string
): { lastScanAt: string | null; scansLast30: number; scansLast90: number; totalScans: number } {
  const log = Array.isArray(transactionLog) ? transactionLog : [];
  const now = Date.now();
  const ms30 = 30 * 24 * 60 * 60 * 1000;
  const ms90 = 90 * 24 * 60 * 60 * 1000;
  let lastScanAt: string | null = null;
  let scansLast30 = 0;
  let scansLast90 = 0;
  let totalScans = 0;
  for (const e of log) {
    if (e.action !== 'SCAN') continue;
    const d = e.data || {};
    const rid = (d.rewardId ?? '').toString();
    const cid = (d.campaignId ?? '').toString();
    const bid = (d.businessId ?? '').toString().trim();
    if (bid !== businessId) continue;
    const matchesToken = rid === tokenId || cid === tokenId || cid.includes(tokenId) || rid.includes(tokenId);
    if (!matchesToken) continue;
    const ts = e.timestamp ? new Date(e.timestamp).getTime() : 0;
    if (ts && (!lastScanAt || ts > new Date(lastScanAt).getTime())) lastScanAt = e.timestamp;
    totalScans++;
    if (ts >= now - ms90) scansLast90++;
    if (ts >= now - ms30) scansLast30++;
  }
  return { lastScanAt, scansLast30, scansLast90, totalScans };
}

// GET /api/v1/businesses/:id/tokens/with-customers - Each token (reward, campaign) with customers and analytics metadata
router.get('/:id/tokens/with-customers', asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.params.id;
  const business = await redis.getBusiness(businessId);
  if (!business) throw new ApiError(404, 'Business not found');
  const [rewardIds, campaignIds] = await Promise.all([
    redisClient.smembers(REDIS_KEYS.businessRewards(businessId)),
    redisClient.smembers(REDIS_KEYS.businessCampaigns(businessId)),
  ]);
  const tokensWithCustomers: Array<{
    tokenId: string;
    type: 'reward' | 'campaign';
    name: string;
    customers: Array<{
      customerId: string;
      customerName: string;
      pointsEarned: number;
      pointsRequired: number;
      lastScanAt: string | null;
      scansLast30: number;
      scansLast90: number;
      totalScans: number;
    }>;
  }> = [];

  const processToken = async (tokenId: string, type: 'reward' | 'campaign') => {
    const doc = type === 'reward'
      ? await redisClient.get(REDIS_KEYS.reward(tokenId))
      : await redisClient.get(REDIS_KEYS.campaign(tokenId));
    const name = doc ? (JSON.parse(doc) as { name?: string }).name : tokenId;
    const customerIds = await redisClient.smembers(REDIS_KEYS.tokenCustomers(tokenId));
    const customers: typeof tokensWithCustomers[0]['customers'] = [];
    for (const cid of customerIds) {
      const customer = await redis.getCustomer(cid);
      if (!customer) continue;
      const rewards = Array.isArray(customer.rewards) ? customer.rewards : [];
      const item = rewards.find((r: { id?: string }) => (r.id ?? '').toString() === tokenId);
      const pointsEarned = typeof (item as { pointsEarned?: number })?.pointsEarned === 'number' ? (item as { pointsEarned: number }).pointsEarned : (typeof (item as { count?: number })?.count === 'number' ? (item as { count: number }).count : 0);
      const pointsRequired = typeof (item as { requirement?: number })?.requirement === 'number' ? (item as { requirement: number }).requirement : (typeof (item as { total?: number })?.total === 'number' ? (item as { total: number }).total : 1);
      const { lastScanAt, scansLast30, scansLast90, totalScans } = scanAnalytics(
        (customer as { transactionLog?: { timestamp: string; action: string; data: Record<string, unknown> }[] }).transactionLog,
        tokenId,
        businessId
      );
      const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || (customer.name ?? '') || customer.email || cid;
      customers.push({ customerId: cid, customerName, pointsEarned, pointsRequired, lastScanAt, scansLast30, scansLast90, totalScans });
    }
    tokensWithCustomers.push({ tokenId, type, name: (name ?? tokenId).toString(), customers });
  };

  for (const tokenId of rewardIds) {
    await processToken(tokenId, 'reward');
  }
  for (const tokenId of campaignIds) {
    await processToken(tokenId, 'campaign');
  }

  res.json({ success: true, data: { tokens: tokensWithCustomers } });
}));

// GET /api/v1/businesses/:id/customer-ids - Token-link index: customer UUIDs connected to this business
router.get('/:id/customer-ids', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const business = await redis.getBusiness(id);
  if (!business) throw new ApiError(404, 'Business not found');
  let customerIds = await redisClient.smembers(REDIS_KEYS.businessCustomers(id));
  if (customerIds.length === 0) {
    let cursor = '0';
    const collected: string[] = [];
    do {
      const [next, keys] = await redisClient.scan(cursor, 'MATCH', 'customer:*', 'COUNT', 200);
      cursor = next;
      for (const key of keys) {
        if (key.startsWith('customer:email:') || key.startsWith('customer:phone:')) continue;
        const customerId = key.slice('customer:'.length);
        if (!customerId || customerId.includes(':')) continue;
        const customer = await redis.getCustomer(customerId);
        if (!customer || !Array.isArray(customer.rewards)) continue;
        const hasBusiness = (customer.rewards as { businessId?: string }[]).some(
          (r) => (r.businessId ?? '').trim() === id
        );
        if (hasBusiness) collected.push(customerId);
      }
    } while (cursor !== '0');
    customerIds = [...new Set(collected)];
  }
  res.json({ success: true, data: { customerIds } });
}));

// GET /api/v1/businesses/:id/customers - Get business's customers (full records)
router.get('/:id/customers', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  
  const business = await redis.getBusiness(id);
  
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  let customerIds: string[] = await redisClient.smembers(REDIS_KEYS.businessCustomers(id));
  
  // Fallback: if set is empty, derive from customer records that have rewards for this business
  if (customerIds.length === 0) {
    const collected: string[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await redisClient.scan(cursor, 'MATCH', 'customer:*', 'COUNT', 200);
      cursor = next;
      for (const key of keys) {
        if (key.startsWith('customer:email:') || key.startsWith('customer:phone:')) continue;
        const customerId = key.slice('customer:'.length);
        if (!customerId || customerId.includes(':')) continue;
        const customer = await redis.getCustomer(customerId);
        if (!customer || !Array.isArray(customer.rewards)) continue;
        const hasBusiness = (customer.rewards as { businessId?: string }[]).some(
          (r) => (r.businessId ?? '').trim() === id
        );
        if (hasBusiness) collected.push(customerId);
      }
    } while (cursor !== '0');
    customerIds = [...new Set(collected)];
  }
  
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

