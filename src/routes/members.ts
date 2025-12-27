import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, REDIS_KEYS } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { Member, ApiResponse } from '../types';

const router = Router();

// GET /api/v1/members - List all members (paginated)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  
  // In production, this would use Redis SCAN for pagination
  // For now, return a placeholder response
  const response: ApiResponse<Member[]> = {
    success: true,
    data: [],
    meta: { page, limit, total: 0 },
  };
  
  res.json(response);
}));

// POST /api/v1/members - Create a new member
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { email, phone, firstName, lastName, preferences } = req.body;
  
  if (!email || !firstName) {
    throw new ApiError(400, 'Email and first name are required');
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const member: Member = {
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
  await redis.setMember(id, member);
  
  // Also index by email for lookups
  await redis.setMember(`email:${email.toLowerCase()}`, { memberId: id });
  
  const response: ApiResponse<Member> = {
    success: true,
    data: member,
  };
  
  res.status(201).json(response);
}));

// GET /api/v1/members/:id - Get a specific member
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const member = await redis.getMember(id);
  
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  const response: ApiResponse<Member> = {
    success: true,
    data: member,
  };
  
  res.json(response);
}));

// PUT /api/v1/members/:id - Update a member
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = await redis.getMember(id);
  
  if (!existing) {
    throw new ApiError(404, 'Member not found');
  }
  
  const updated: Member = {
    ...existing,
    ...updates,
    id, // Ensure ID can't be changed
    updatedAt: new Date().toISOString(),
  };
  
  await redis.setMember(id, updated);
  
  const response: ApiResponse<Member> = {
    success: true,
    data: updated,
  };
  
  res.json(response);
}));

// GET /api/v1/members/:id/stamps - Get member's stamps across all businesses
router.get('/:id/stamps', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { businessId } = req.query;
  
  const member = await redis.getMember(id);
  
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  if (businessId) {
    const count = await redis.getStampCount(id, businessId as string);
    return res.json({
      success: true,
      data: {
        memberId: id,
        businessId,
        stampCount: count,
      },
    });
  }
  
  // TODO: Get stamps across all businesses
  res.json({
    success: true,
    data: {
      memberId: id,
      stamps: [],
    },
  });
}));

// POST /api/v1/members/:id/stamps - Add a stamp to a member's card
router.post('/:id/stamps', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { businessId, rewardId, method = 'qr' } = req.body;
  
  if (!businessId) {
    throw new ApiError(400, 'Business ID is required');
  }
  
  const member = await redis.getMember(id);
  
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  // Add the stamp
  const stampData = {
    id: uuidv4(),
    rewardId,
    method,
    issuedAt: new Date().toISOString(),
  };
  
  const newCount = await redis.addStamp(id, businessId, stampData);
  
  // Update member's total stamps
  await redis.setMember(id, {
    ...member,
    totalStamps: (member.totalStamps || 0) + 1,
    updatedAt: new Date().toISOString(),
  });
  
  res.status(201).json({
    success: true,
    data: {
      memberId: id,
      businessId,
      stampCount: newCount,
      stamp: stampData,
    },
  });
}));

export default router;


















