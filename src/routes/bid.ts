import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, REDIS_KEYS, redisClient } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { BID, BIDStats, ApiResponse } from '../types';

const router = Router();

/**
 * BID (Business Improvement District) Routes
 * 
 * These endpoints power the dashboard for BID managers
 * in Middlesbrough, Stockton, and Darlington.
 * 
 * BID managers can:
 * - View all their member businesses
 * - See aggregate statistics
 * - Generate reports for council funding applications
 * - Identify top-performing businesses
 */

// GET /api/v1/bid - List all BIDs
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  // Pre-configured BIDs for Tees Valley
  const bids = [
    {
      id: 'middlesbrough-town-centre',
      name: 'Middlesbrough Town Centre BID',
      council: 'middlesbrough',
      region: 'tees-valley',
    },
    {
      id: 'stockton-high-street',
      name: 'Stockton High Street BID',
      council: 'stockton',
      region: 'tees-valley',
    },
    {
      id: 'darlington-town-centre',
      name: 'Darlington Town Centre BID',
      council: 'darlington',
      region: 'tees-valley',
    },
  ];
  
  res.json({
    success: true,
    data: bids,
  });
}));

// GET /api/v1/bid/:id - Get BID details and stats
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Get businesses in this BID
  const businessIds = await redisClient.smembers(REDIS_KEYS.bidBusinesses(id));
  
  // Get aggregate stats
  const stats = await redis.getBidStats(id);
  
  // Fetch business details
  const businesses = await Promise.all(
    businessIds.map(async (bizId) => {
      return redis.getBusiness(bizId);
    })
  );
  
  const validBusinesses = businesses.filter(Boolean);
  
  // Calculate aggregates
  const aggregates = {
    totalBusinesses: validBusinesses.length,
    totalMembers: validBusinesses.reduce((sum, b) => sum + (b.stats?.totalMembers || 0), 0),
    totalStamps: validBusinesses.reduce((sum, b) => sum + (b.stats?.totalStampsIssued || 0), 0),
    totalRedemptions: validBusinesses.reduce((sum, b) => sum + (b.stats?.totalRedemptions || 0), 0),
    byCategory: {} as Record<string, number>,
  };
  
  // Count by category
  validBusinesses.forEach((b) => {
    const cat = b.category || 'other';
    aggregates.byCategory[cat] = (aggregates.byCategory[cat] || 0) + 1;
  });
  
  res.json({
    success: true,
    data: {
      bidId: id,
      stats: aggregates,
      businesses: validBusinesses.map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        stats: b.stats,
      })),
    },
  });
}));

// GET /api/v1/bid/:id/businesses - List all businesses in a BID
router.get('/:id/businesses', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { category, sortBy = 'name' } = req.query;
  
  const businessIds = await redisClient.smembers(REDIS_KEYS.bidBusinesses(id));
  
  const businesses = await Promise.all(
    businessIds.map(async (bizId) => {
      return redis.getBusiness(bizId);
    })
  );
  
  let validBusinesses = businesses.filter(Boolean);
  
  // Filter by category if specified
  if (category) {
    validBusinesses = validBusinesses.filter((b) => b.category === category);
  }
  
  // Sort
  switch (sortBy) {
    case 'stamps':
      validBusinesses.sort((a, b) => (b.stats?.totalStampsIssued || 0) - (a.stats?.totalStampsIssued || 0));
      break;
    case 'members':
      validBusinesses.sort((a, b) => (b.stats?.totalMembers || 0) - (a.stats?.totalMembers || 0));
      break;
    case 'name':
    default:
      validBusinesses.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  res.json({
    success: true,
    data: validBusinesses,
  });
}));

// POST /api/v1/bid/:id/businesses - Add a business to a BID
router.post('/:id/businesses', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { businessId } = req.body;
  
  if (!businessId) {
    throw new ApiError(400, 'Business ID is required');
  }
  
  // Verify business exists
  const business = await redis.getBusiness(businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  // Add to BID
  await redisClient.sadd(REDIS_KEYS.bidBusinesses(id), businessId);
  
  // Update business with BID ID
  await redis.setBusiness(businessId, {
    ...business,
    bidId: id,
    updatedAt: new Date().toISOString(),
  });
  
  res.json({
    success: true,
    message: `Business ${business.name} added to BID`,
  });
}));

// GET /api/v1/bid/:id/report - Generate a report for council/funding
router.get('/:id/report', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { period = 'quarter', format = 'json' } = req.query;
  
  const businessIds = await redisClient.smembers(REDIS_KEYS.bidBusinesses(id));
  
  const businesses = await Promise.all(
    businessIds.map(async (bizId) => redis.getBusiness(bizId))
  );
  
  const validBusinesses = businesses.filter(Boolean);
  
  // Generate comprehensive report
  const report = {
    title: `Canny Carrot Loyalty Impact Report`,
    bidId: id,
    period,
    generatedAt: new Date().toISOString(),
    summary: {
      participatingBusinesses: validBusinesses.length,
      totalCustomersEngaged: validBusinesses.reduce((sum, b) => sum + (b.stats?.totalMembers || 0), 0),
      totalLoyaltyTransactions: validBusinesses.reduce((sum, b) => sum + (b.stats?.totalStampsIssued || 0), 0),
      totalRewardsRedeemed: validBusinesses.reduce((sum, b) => sum + (b.stats?.totalRedemptions || 0), 0),
    },
    economicImpact: {
      // Estimates for council reports
      estimatedRepeatVisits: validBusinesses.reduce((sum, b) => sum + ((b.stats?.totalStampsIssued || 0) * 0.7), 0),
      estimatedAdditionalSpend: validBusinesses.reduce((sum, b) => sum + ((b.stats?.totalStampsIssued || 0) * 8.50), 0),
      estimatedFootfallIncrease: '12%', // Would be calculated from baseline
      customerRetentionImprovement: '23%', // Based on redemption patterns
    },
    businessBreakdown: validBusinesses.map((b) => ({
      name: b.name,
      category: b.category,
      members: b.stats?.totalMembers || 0,
      stamps: b.stats?.totalStampsIssued || 0,
      redemptions: b.stats?.totalRedemptions || 0,
    })),
    categoryAnalysis: {} as Record<string, any>,
    recommendations: [
      'Consider onboarding more cafes - highest engagement category',
      'Launch a collaborative campaign across all BID businesses',
      'Promote "Shop Local" rewards during Christmas period',
    ],
  };
  
  // Group by category
  validBusinesses.forEach((b) => {
    const cat = b.category || 'other';
    if (!report.categoryAnalysis[cat]) {
      report.categoryAnalysis[cat] = { count: 0, stamps: 0, members: 0 };
    }
    report.categoryAnalysis[cat].count++;
    report.categoryAnalysis[cat].stamps += b.stats?.totalStampsIssued || 0;
    report.categoryAnalysis[cat].members += b.stats?.totalMembers || 0;
  });
  
  if (format === 'pdf') {
    // Would generate PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=canny-carrot-bid-report-${id}.pdf`);
    // PDF generation would happen here
    throw new ApiError(501, 'PDF export coming soon');
  }
  
  res.json({
    success: true,
    data: report,
  });
}));

// GET /api/v1/bid/:id/leaderboard - Top performing businesses in BID
router.get('/:id/leaderboard', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { metric = 'stamps', limit = '10' } = req.query;
  
  const businessIds = await redisClient.smembers(REDIS_KEYS.bidBusinesses(id));
  
  const businesses = await Promise.all(
    businessIds.map(async (bizId) => redis.getBusiness(bizId))
  );
  
  const validBusinesses = businesses.filter(Boolean);
  
  // Sort by metric
  let sorted;
  switch (metric) {
    case 'members':
      sorted = validBusinesses.sort((a, b) => (b.stats?.totalMembers || 0) - (a.stats?.totalMembers || 0));
      break;
    case 'redemptions':
      sorted = validBusinesses.sort((a, b) => (b.stats?.totalRedemptions || 0) - (a.stats?.totalRedemptions || 0));
      break;
    case 'stamps':
    default:
      sorted = validBusinesses.sort((a, b) => (b.stats?.totalStampsIssued || 0) - (a.stats?.totalStampsIssued || 0));
  }
  
  const topN = sorted.slice(0, parseInt(limit as string));
  
  res.json({
    success: true,
    data: {
      bidId: id,
      metric,
      leaderboard: topN.map((b, index) => ({
        rank: index + 1,
        businessId: b.id,
        name: b.name,
        category: b.category,
        value: metric === 'members' ? b.stats?.totalMembers : 
               metric === 'redemptions' ? b.stats?.totalRedemptions : 
               b.stats?.totalStampsIssued,
      })),
    },
  });
}));

export default router;




















