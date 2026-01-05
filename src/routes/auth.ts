/**
 * Authentication Routes for Business App
 * Handles business user login and account creation
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { redis, REDIS_KEYS, redisClient, connectRedis } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';

const router = Router();

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'canny-carrot-jwt-secret-change-in-production';

interface BusinessAuth {
  email: string;
  passwordHash: string;
  businessId: string;
  createdAt: string;
}

/**
 * POST /api/v1/auth/business/register
 * Register a business user account (from invitation)
 */
router.post('/business/register', asyncHandler(async (req: Request, res: Response) => {
  await connectRedis();
  
  const { email, password, businessId, invitationToken } = req.body;
  
  if (!email || !password || !businessId) {
    throw new ApiError(400, 'Email, password, and businessId are required');
  }
  
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }
  
  // Verify business exists in Redis
  const business = await redis.getBusiness(businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  // Check if auth already exists for this email
  const emailLower = email.toLowerCase();
  const existingAuthKey = REDIS_KEYS.businessAuthByEmail(emailLower);
  const existingAuth = await redisClient.get(existingAuthKey);
  
  if (existingAuth) {
    throw new ApiError(409, 'Account already exists for this email');
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Store auth credentials in Redis
  // Key: business:auth:{email} -> { passwordHash, businessId, createdAt }
  const authData: BusinessAuth = {
    email: emailLower,
    passwordHash,
    businessId,
    createdAt: new Date().toISOString(),
  };
  
  const authKey = REDIS_KEYS.businessAuthByEmail(emailLower);
  await redisClient.set(authKey, JSON.stringify(authData));
  
  // Also create index: business:${businessId}:auth:${email} -> email (for lookup by business)
  const businessAuthIndex = `business:${businessId}:auth:${emailLower}`;
  await redisClient.set(businessAuthIndex, emailLower);
  
  // Generate JWT token
  const token = jwt.sign(
    { email: emailLower, businessId, type: 'business' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  const response: ApiResponse<{ token: string; businessId: string; email: string }> = {
    success: true,
    data: {
      token,
      businessId,
      email: emailLower,
    },
  };
  
  res.status(201).json(response);
}));

/**
 * POST /api/v1/auth/business/login
 * Login with email and password
 */
router.post('/business/login', asyncHandler(async (req: Request, res: Response) => {
  await connectRedis();
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }
  
  // Get auth data from Redis
  const emailLower = email.toLowerCase();
  const authKey = REDIS_KEYS.businessAuthByEmail(emailLower);
  const authDataStr = await redisClient.get(authKey);
  
  if (!authDataStr) {
    throw new ApiError(401, 'Invalid email or password');
  }
  
  const authData: BusinessAuth = JSON.parse(authDataStr);
  
  // Verify password
  const passwordValid = await bcrypt.compare(password, authData.passwordHash);
  
  if (!passwordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }
  
  // Verify business still exists
  const business = await redis.getBusiness(authData.businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  // Generate JWT token
  const token = jwt.sign(
    { email: emailLower, businessId: authData.businessId, type: 'business' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  const response: ApiResponse<{ token: string; businessId: string; email: string }> = {
    success: true,
    data: {
      token,
      businessId: authData.businessId,
      email: emailLower,
    },
  };
  
  res.json(response);
}));

export default router;



