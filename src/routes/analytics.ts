import { Router, Request, Response } from 'express';
import { redis, REDIS_KEYS, redisClient } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { RegionalStats, CouncilStats } from '../types';

const router = Router();

// GET /api/v1/analytics/regional - Get Tees Valley regional statistics
// This is the key endpoint for Tees Valley Combined Authority reports
router.get('/regional', asyncHandler(async (req: Request, res: Response) => {
  const { period = 'month' } = req.query;
  
  // Calculate date range
  const now = new Date();
  let startDate: Date;
  
  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'quarter':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  
  // In production, these would be aggregated from Redis
  // For now, return structure with placeholder data
  const stats: RegionalStats = {
    region: 'tees-valley',
    councils: {
      middlesbrough: {
        businesses: 0,
        members: 0,
        stamps: 0,
        redemptions: 0,
        topCategories: [],
      },
      stockton: {
        businesses: 0,
        members: 0,
        stamps: 0,
        redemptions: 0,
        topCategories: [],
      },
      darlington: {
        businesses: 0,
        members: 0,
        stamps: 0,
        redemptions: 0,
        topCategories: [],
      },
    },
    totals: {
      businesses: 0,
      members: 0,
      stamps: 0,
      redemptions: 0,
      estimatedEconomicImpact: 0,
    },
    period: period as string,
    generatedAt: now.toISOString(),
  };
  
  res.json({
    success: true,
    data: stats,
  });
}));

// GET /api/v1/analytics/council/:council - Get stats for a specific council area
router.get('/council/:council', asyncHandler(async (req: Request, res: Response) => {
  const { council } = req.params;
  const { period = 'month' } = req.query;
  
  const validCouncils = ['middlesbrough', 'stockton', 'darlington', 'hartlepool', 'redcar'];
  
  if (!validCouncils.includes(council.toLowerCase())) {
    throw new ApiError(400, `Invalid council. Must be one of: ${validCouncils.join(', ')}`);
  }
  
  // Placeholder stats - would be computed from Redis
  const stats: CouncilStats = {
    businesses: 0,
    members: 0,
    stamps: 0,
    redemptions: 0,
    topCategories: [],
  };
  
  res.json({
    success: true,
    data: {
      council,
      period,
      stats,
      generatedAt: new Date().toISOString(),
    },
  });
}));

// GET /api/v1/analytics/daily - Get daily statistics
router.get('/daily', asyncHandler(async (req: Request, res: Response) => {
  const { date, days = '7' } = req.query;
  
  const numDays = parseInt(days as string);
  const endDate = date ? new Date(date as string) : new Date();
  
  const dailyStats = [];
  
  for (let i = 0; i < numDays; i++) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    const stats = await redisClient.hgetall(REDIS_KEYS.dailyStats(dateStr));
    
    dailyStats.push({
      date: dateStr,
      stamps: parseInt(stats.stamps || '0'),
      redemptions: parseInt(stats.redemptions || '0'),
      newMembers: parseInt(stats.newMembers || '0'),
      newBusinesses: parseInt(stats.newBusinesses || '0'),
    });
  }
  
  res.json({
    success: true,
    data: dailyStats.reverse(), // Oldest first
  });
}));

// GET /api/v1/analytics/business/:id - Get analytics for a specific business
router.get('/business/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { period = 'month' } = req.query;
  
  const business = await redis.getBusiness(id);
  
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  // Get member count
  const memberCount = await redisClient.scard(REDIS_KEYS.businessMembers(id));
  
  // Calculate growth metrics (would be from historical data)
  res.json({
    success: true,
    data: {
      businessId: id,
      businessName: business.name,
      period,
      stats: {
        ...business.stats,
        totalMembers: memberCount,
      },
      growth: {
        membersChange: 0,
        stampsChange: 0,
        redemptionsChange: 0,
      },
      // For council reports - estimated economic impact
      economicImpact: {
        estimatedRepeatVisits: business.stats.totalStampsIssued * 0.7, // 70% of stamps = visits
        estimatedRevenue: business.stats.totalStampsIssued * 8.50, // Average spend per visit
        customerRetentionRate: 0, // Would be calculated from redemption patterns
      },
      generatedAt: new Date().toISOString(),
    },
  });
}));

// GET /api/v1/analytics/export - Export data for reporting (CSV/JSON)
router.get('/export', asyncHandler(async (req: Request, res: Response) => {
  const { format = 'json', type, period = 'month', council } = req.query;
  
  // This endpoint is for council reporting
  // Would generate formatted reports for Tees Valley CA, BIDs, etc.
  
  const reportData = {
    reportType: type || 'summary',
    period,
    council: council || 'all',
    generatedAt: new Date().toISOString(),
    generatedBy: 'Canny Carrot Loyalty Platform',
    data: {
      // Report data would go here
    },
  };
  
  if (format === 'csv') {
    // Convert to CSV
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=canny-carrot-report-${period}.csv`);
    // Would convert reportData to CSV format
    res.send('date,businesses,members,stamps,redemptions\n');
  } else {
    res.json({
      success: true,
      data: reportData,
    });
  }
}));

// GET /api/v1/analytics/leaderboard - Top businesses by engagement
router.get('/leaderboard', asyncHandler(async (req: Request, res: Response) => {
  const { category, council, limit = '10' } = req.query;
  
  // Would return top-performing businesses
  // Useful for BID managers to showcase success stories
  
  res.json({
    success: true,
    data: {
      leaderboard: [],
      period: 'month',
      filters: { category, council },
      generatedAt: new Date().toISOString(),
    },
  });
}));

export default router;




















