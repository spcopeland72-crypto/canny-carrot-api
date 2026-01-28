import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../config/redis';
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
  const { email, phone, firstName, lastName, preferences } = req.body;
  
  if (!email || !firstName) {
    throw new ApiError(400, 'Email and first name are required');
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const customer: Customer = {
    id,
    email: email.toLowerCase(),
    phone,
    firstName,
    lastName: lastName || '',
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

// GET /api/v1/customers/:id - Get full record (account + rewards)
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const record = await customerRecordService.getById(id);
  if (!record) throw new ApiError(404, 'Customer not found');
  res.json({ success: true, data: record });
}));

// PUT /api/v1/customers/:id - Update a customer (merge)
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
    updatedAt: new Date().toISOString(),
  };
  if (Array.isArray(updates?.rewards)) updated.rewards = updates.rewards;

  await redis.setCustomer(id, updated);
  const email = updated.email ?? existing?.email;
  if (email) await redis.setCustomerEmailIndex(email, id);

  const response: ApiResponse<typeof updated> = {
    success: true,
    data: updated,
  };
  
  res.json(response);
}));

// PUT /api/v1/customers/:id/sync - Full replace: app sends { ...account, rewards }.
// API adapter stores CustomerRecord, updates email index. Returns app-shaped blob.
router.put('/:id/sync', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  if (!body || typeof body !== 'object') throw new ApiError(400, 'Request body must be an object');
  const rewards = Array.isArray(body.rewards) ? body.rewards : [];
  const now = new Date().toISOString();
  const { rewards: _r, ...account } = body;
  const record: CustomerRecord = {
    ...(account as Partial<CustomerRecord>),
    id,
    email: (body.email as string) ?? '',
    firstName: (body.firstName as string) ?? '',
    lastName: (body.lastName as string) ?? '',
    createdAt: (body.createdAt as string) || now,
    updatedAt: now,
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
  
  // Update customer's total stamps
  await redis.setCustomer(id, {
    ...customer,
    totalStamps: (customer.totalStamps || 0) + 1,
    updatedAt: new Date().toISOString(),
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







