/**
 * Authentication Routes for Business App and Customer App
 * Business: login, register (invitation). Customer: login, register (email must match existing customer).
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { redis, REDIS_KEYS, redisClient, connectRedis } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'canny-carrot-jwt-secret-change-in-production';

interface BusinessAuth {
  email: string;
  passwordHash: string;
  businessId: string;
  createdAt: string;
}

interface CustomerAuth {
  email: string;
  passwordHash: string;
  customerId: string;
  createdAt: string;
}

/**
 * POST /api/v1/auth/business/register
 * Register a business user account (from invitation)
 */
router.post('/business/register', asyncHandler(async (req: Request, res: Response) => {
  console.log('🔐 ========================================');
  console.log('🔐 AUTH ENDPOINT CALL RECEIVED');
  console.log('🔐 ========================================');
  console.log('🔐 Request body:', {
    email: req.body.email,
    businessId: req.body.businessId,
    hasPassword: !!req.body.password,
    passwordLength: req.body.password?.length || 0,
  });
  
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
  console.log('🔐 Storing auth credentials in Redis key:', authKey);
  await redisClient.set(authKey, JSON.stringify(authData));
  console.log('🔐 ✅ Auth credentials stored in Redis');
  
  // Also create index: business:${businessId}:auth:${email} -> email (for lookup by business)
  const businessAuthIndex = `business:${businessId}:auth:${emailLower}`;
  console.log('🔐 Creating business auth index:', businessAuthIndex);
  await redisClient.set(businessAuthIndex, emailLower);
  console.log('🔐 ✅ Business auth index created');
  
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
  
  console.log('🔐 ✅ AUTH CREATION SUCCESSFUL');
  console.log('🔐 Created auth data:', {
    email: emailLower,
    businessId: businessId,
    createdAt: authData.createdAt,
    hasPasswordHash: !!authData.passwordHash,
  });
  console.log('🔐 ========================================');
  
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
  
  // Track device login (if deviceId provided)
  const { deviceId } = req.body;
  if (deviceId && typeof deviceId === 'string') {
    try {
      const deviceKey = REDIS_KEYS.businessDevices(authData.businessId);
      const deviceInfo = {
        deviceId,
        email: emailLower,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      // Store device info as hash: business:${businessId}:devices:${deviceId} -> {deviceId, email, lastLoginAt, createdAt}
      await redisClient.set(
        `business:${authData.businessId}:devices:${deviceId}`,
        JSON.stringify(deviceInfo),
        'EX',
        60 * 60 * 24 * 30 // Expire after 30 days of inactivity
      );
      // Also add deviceId to set for quick lookup: business:${businessId}:devices -> set of deviceIds
      await redisClient.sadd(deviceKey, deviceId);
      console.log(`📱 [AUTH] Device login tracked: ${deviceId} for business ${authData.businessId}`);
    } catch (error: any) {
      // Don't fail login if device tracking fails
      console.error('⚠️ [AUTH] Failed to track device login:', error.message);
    }
  }
  
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

/**
 * POST /api/v1/auth/customer/register
 * Set password for existing customer (email must match customer record).
 */
router.post('/customer/register', asyncHandler(async (req: Request, res: Response) => {
  await connectRedis();
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');
  if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');

  const emailLower = (email as string).toLowerCase().trim();
  const customerId = await redis.getCustomerIdByEmail(emailLower);
  if (!customerId) throw new ApiError(404, 'No customer account found for this email');

  const authKey = REDIS_KEYS.customerAuthByEmail(emailLower);
  const existing = await redisClient.get(authKey);
  if (existing) throw new ApiError(409, 'Account already exists for this email');

  const passwordHash = await bcrypt.hash(password, 10);
  const authData: CustomerAuth = {
    email: emailLower,
    passwordHash,
    customerId,
    createdAt: new Date().toISOString(),
  };
  await redisClient.set(authKey, JSON.stringify(authData));

  const token = jwt.sign(
    { email: emailLower, customerId, type: 'customer' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const response: ApiResponse<{ token: string; customerId: string; email: string }> = {
    success: true,
    data: { token, customerId, email: emailLower },
  };
  res.status(201).json(response);
}));

/**
 * POST /api/v1/auth/customer/login
 * Login with email and password. Same contract as business login.
 */
router.post('/customer/login', asyncHandler(async (req: Request, res: Response) => {
  await connectRedis();
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');

  const emailLower = (email as string).toLowerCase().trim();
  const authKey = REDIS_KEYS.customerAuthByEmail(emailLower);
  const authDataStr = await redisClient.get(authKey);
  if (!authDataStr) throw new ApiError(401, 'Invalid email or password');

  const authData: CustomerAuth = JSON.parse(authDataStr);
  const valid = await bcrypt.compare(password, authData.passwordHash);
  if (!valid) throw new ApiError(401, 'Invalid email or password');

  const customer = await redis.getCustomer(authData.customerId);
  if (!customer) throw new ApiError(404, 'Customer account not found');

  const token = jwt.sign(
    { email: emailLower, customerId: authData.customerId, type: 'customer' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const response: ApiResponse<{ token: string; customerId: string; email: string }> = {
    success: true,
    data: {
      token,
      customerId: authData.customerId,
      email: emailLower,
    },
  };
  res.json(response);
}));

export default router;



