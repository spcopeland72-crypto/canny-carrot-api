import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, REDIS_KEYS } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { Customer, ApiResponse } from '../types';

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
  
  // Also index by email for lookups
  await redis.setCustomer(`email:${email.toLowerCase()}`, { customerId: id });
  
  const response: ApiResponse<Customer> = {
    success: true,
    data: customer,
  };
  
  res.status(201).json(response);
}));

// GET /api/v1/customers/:id - Get a specific customer
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const customer = await redis.getCustomer(id);
  
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }
  
  const response: ApiResponse<Customer> = {
    success: true,
    data: customer,
  };
  
  res.json(response);
}));

// PUT /api/v1/customers/:id - Update a customer
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = await redis.getCustomer(id);
  
  if (!existing) {
    throw new ApiError(404, 'Customer not found');
  }
  
  const updated: Customer = {
    ...existing,
    ...updates,
    id, // Ensure ID can't be changed
    updatedAt: new Date().toISOString(),
  };
  
  await redis.setCustomer(id, updated);
  
  const response: ApiResponse<Customer> = {
    success: true,
    data: updated,
  };
  
  res.json(response);
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




