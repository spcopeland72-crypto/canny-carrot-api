import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, redisClient, REDIS_KEYS } from '../config/redis';
import { customerRecordService } from '../services/customerRecordService';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { Customer, ApiResponse } from '../types';
import type { CustomerRecord } from '../types/customerRecord';

const router = Router();

// GET /api/v1/customers - List all customers (paginated)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  
  // In production, this would use Redis SCAN for pagination
  // For now, return a placeholder response
  const response: ApiResponse<Customer[]> = {
    success: true,
    data: [],
    meta: { page, limit, total: 0 },
  };
  
  res.json(response);
}));

// GET /api/v1/customers/by-email/:email - Resolve by email, return full record (account + rewards)
router.get('/by-email/:email', asyncHandler(async (req: Request, res: Response) => {
  const email = decodeURIComponent((req.params.email ?? '').trim());
  if (!email) throw new ApiError(400, 'Email is required');
  const record = await customerRecordService.getByEmail(email);
  if (!record) throw new ApiError(404, 'Customer not found');
  res.json({ success: true, data: record });
}));

// POST /api/v1/customers - Create a new customer
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { email, phone, firstName, lastName, preferences, dateOfBirth, birthDay, birthMonth } = req.body;
  
  if (!email || !firstName) {
    throw new ApiError(400, 'Email and first name are required');
  }

  // UUID created at registration; this is the stable customer identity (email can change).
  const id = uuidv4();
  const now = new Date().toISOString();
  
  // Build dateOfBirth: accept ISO string or day+month (store as YYYY-MM-DD, year 2000 for birthday-only)
  let dob: string | undefined;
  if (dateOfBirth && typeof dateOfBirth === 'string') {
    dob = dateOfBirth;
  } else if (birthDay != null && birthMonth != null) {
    const d = Number(birthDay);
    const m = Number(birthMonth);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      dob = `2000-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  
  const customer: Customer = {
    id,
    email: email.toLowerCase(),
    phone,
    firstName,
    lastName: lastName || '',
    dateOfBirth: dob,
    createdAt: now,
    updatedAt: now,
    preferences: preferences || {
      notifications: true,
      marketing: false,
    },
    totalStamps: 0,
    totalRedemptions: 0,
  };
  
  // Store in Redis
  await redis.setCustomer(id, customer);
  await redis.setCustomerEmailIndex(email, id);

  const response: ApiResponse<Customer> = {
    success: true,
    data: customer,
  };
  
  res.status(201).json(response);
}));

// GET /api/v1/customers/:id/businesses - Token-link index: business UUIDs this customer has tokens with
router.get('/:id/businesses', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const exists = await customerRecordService.getById(id);
  if (!exists) throw new ApiError(404, 'Customer not found');
  const businessIds = await redisClient.smembers(REDIS_KEYS.customerBusinesses(id));
  res.json({ success: true, data: { businessIds } });
}));

// GET /api/v1/customers/:id/tokens - Token-link index: reward/campaign/action UUIDs this customer has
router.get('/:id/tokens', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const exists = await customerRecordService.getById(id);
  if (!exists) throw new ApiError(404, 'Customer not found');
  const tokenIds = await redisClient.smembers(REDIS_KEYS.customerTokens(id));
  res.json({ success: true, data: { tokenIds } });
}));

// GET /api/v1/customers/:id/summary - Businesses and tokens with points (for redemption / dashboard)
router.get('/:id/summary', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const record = await customerRecordService.getById(id);
  if (!record) throw new ApiError(404, 'Customer not found');
  const rewards = Array.isArray(record.rewards) ? record.rewards : [];
  const businessIds = [...new Set(rewards.map((r: { businessId?: string }) => (r.businessId ?? '').trim()).filter(Boolean))];
  const businessNames: Record<string, string> = {};
  for (const bid of businessIds) {
    const b = await redis.getBusiness(bid);
    businessNames[bid] = (b as { name?: string; profile?: { name?: string } })?.name ?? (b as { profile?: { name?: string } })?.profile?.name ?? bid;
  }
  const tokens = rewards.map((r: { id?: string; name?: string; businessId?: string; pointsEarned?: number; count?: number; requirement?: number; total?: number; tokenKind?: string }) => {
    const tokenId = (r.id ?? '').toString();
    const type = r.tokenKind === 'campaign' ? 'campaign' : 'reward';
    const pointsEarned = typeof r.pointsEarned === 'number' ? r.pointsEarned : (typeof r.count === 'number' ? r.count : 0);
    const pointsRequired = typeof r.requirement === 'number' ? r.requirement : (typeof r.total === 'number' ? r.total : 1);
    const businessId = (r.businessId ?? '').trim();
    return {
      tokenId,
      type,
      name: (r.name ?? tokenId).toString(),
      businessId,
      businessName: businessNames[businessId] ?? businessId,
      pointsEarned,
      pointsRequired,
      canRedeem: pointsEarned >= pointsRequired,
    };
  });
  res.json({
    success: true,
    data: {
      businesses: businessIds.map((bid) => ({ businessId: bid, businessName: businessNames[bid] ?? bid })),
      tokens,
    },
  });
}));

// GET /api/v1/customers/:id - Get full record (account + rewards)
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const record = await customerRecordService.getById(id);
  if (!record) throw new ApiError(404, 'Customer not found');
  res.json({ success: true, data: record });
}));

// PUT /api/v1/customers/:id - Update a customer (merge)
// API is pure pass-through: do not set updatedAt; use client-sent or existing only.
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = await redis.getCustomer(id);
  
  if (!existing) {
    throw new ApiError(404, 'Customer not found');
  }
  
  const updated: Customer & { rewards?: unknown[] } = {
    ...existing,
    ...updates,
    id,
    updatedAt: (updates?.updatedAt as string) ?? existing.updatedAt,
  };
  if (Array.isArray(updates?.rewards)) updated.rewards = updates.rewards;

  const oldEmail = (existing?.email ?? '').toString().toLowerCase().trim();
  const newEmail = (updated.email ?? '').toString().toLowerCase().trim();
  if (oldEmail && oldEmail !== newEmail) {
    await redis.deleteCustomerEmailIndex(oldEmail);
  }
  await redis.setCustomer(id, updated);
  if (newEmail) await redis.setCustomerEmailIndex(newEmail, id);

  const response: ApiResponse<typeof updated> = {
    success: true,
    data: updated,
  };
  
  res.json(response);
}));

// PUT /api/v1/customers/:id/sync - Full replace: app sends { ...account, rewards }.
// API is pure pass-through: store exactly what the client sent; do not set updatedAt or createdAt.
router.put('/:id/sync', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  if (!body || typeof body !== 'object') throw new ApiError(400, 'Request body must be an object');
  const rewards = Array.isArray(body.rewards) ? body.rewards : [];
  const existing = await customerRecordService.getById(id);
  const { rewards: _r, ...account } = body;
  const record: CustomerRecord = {
    ...(account as Partial<CustomerRecord>),
    id,
    email: (body.email as string) ?? '',
    firstName: (body.firstName as string) ?? '',
    lastName: (body.lastName as string) ?? '',
    createdAt: (body.createdAt as string) ?? existing?.createdAt ?? '',
    updatedAt: (body.updatedAt as string) ?? existing?.updatedAt ?? (body.createdAt as string) ?? '',
    rewards: rewards as CustomerRecord['rewards'],
  };
  await customerRecordService.replace(id, record);
  res.json({ success: true, data: record });
}));

// GET /api/v1/customers/:id/stamps - Get customer's stamps across all businesses
router.get('/:id/stamps', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { businessId } = req.query;
  
  const customer = await redis.getCustomer(id);
  
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }
  
  if (businessId) {
    const count = await redis.getStampCount(id, businessId as string);
    return res.json({
      success: true,
      data: {
        customerId: id,
        businessId,
        stampCount: count,
      },
    });
  }
  
  // TODO: Get stamps across all businesses
  res.json({
    success: true,
    data: {
      customerId: id,
      stamps: [],
    },
  });
}));

// POST /api/v1/customers/:id/stamps - Add a stamp to a customer's card
router.post('/:id/stamps', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { businessId, rewardId, method = 'qr' } = req.body;
  
  if (!businessId) {
    throw new ApiError(400, 'Business ID is required');
  }
  
  const customer = await redis.getCustomer(id);
  
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }
  
  // Add the stamp
  const stampData = {
    id: uuidv4(),
    rewardId,
    method,
    issuedAt: new Date().toISOString(),
  };
  
  const newCount = await redis.addStamp(id, businessId, stampData);
  
  // Update customer's total stamps. API pass-through: do not set updatedAt; preserve existing.
  await redis.setCustomer(id, {
    ...customer,
    totalStamps: (customer.totalStamps || 0) + 1,
    updatedAt: customer.updatedAt,
  });
  
  res.status(201).json({
    success: true,
    data: {
      customerId: id,
      businessId,
      stampCount: newCount,
      stamp: stampData,
    },
  });
}));

export default router;







