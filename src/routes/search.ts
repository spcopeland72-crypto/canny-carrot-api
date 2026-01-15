/**
 * GeoSearch Routes
 * POST /api/v1/search/text - Text-based search
 * POST /api/v1/search/map - Map-based search
 * 
 * Returns businesses with their rewards and campaigns based on search criteria
 */

import { Router, Request, Response } from 'express';
import { redis, REDIS_KEYS, redisClient, connectRedis } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { Business } from '../types';

const router = Router();

interface SearchCriteria {
  businessName?: string;
  sector?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    street?: string;
    postcode?: string;
  };
  rewardsOnly?: boolean;
  campaignsOnly?: boolean;
  distance?: number; // in miles
  sortBy?: 'distance' | 'name' | 'relevance';
  page?: number;
  pageSize?: number;
}

interface MapBounds {
  northeast: { lat: number; lng: number };
  southwest: { lat: number; lng: number };
}

interface SearchResult {
  results: Business[];
  totalCount: number;
  page?: number;
  hasMore?: boolean;
}

/**
 * POST /api/v1/search/text
 * Text-based search for businesses
 */
router.post('/text', asyncHandler(async (req: Request, res: Response) => {
  await connectRedis();

  const criteria: SearchCriteria = req.body;
  const page = criteria.page || 1;
  const pageSize = criteria.pageSize || 20;

  // Get all business IDs from Redis
  let businessIds: string[] = [];
  
  try {
    const allBusinessIds = await redisClient.smembers('businesses:all');
    if (allBusinessIds && allBusinessIds.length > 0) {
      businessIds = allBusinessIds;
    } else {
      // Fallback: scan for business:* keys
      const keys: string[] = [];
      let cursor = '0';
      
      do {
        const [nextCursor, foundKeys] = await redisClient.scan(
          cursor,
          'MATCH',
          'business:*',
          'COUNT',
          '100'
        );
        cursor = nextCursor;
        keys.push(...foundKeys);
        if (keys.length >= 1000) break;
      } while (cursor !== '0');
      
      businessIds = keys
        .map(key => key.replace('business:', ''))
        .filter(id => id.length > 0);
    }
  } catch (error: any) {
    console.error('[SEARCH] Error fetching business IDs:', error);
    return res.json({
      success: true,
      data: {
        results: [],
        totalCount: 0,
        page,
      },
    });
  }

  // Fetch businesses and apply filters
  const matchingBusinesses: Business[] = [];
  
  for (const businessId of businessIds.slice(0, 500)) { // Limit to prevent timeout
    try {
      const businessAny = await redis.getBusiness(businessId) as any;
      if (!businessAny || !businessAny.status || businessAny.status.toLowerCase() !== 'active') {
        continue;
      }

      // Apply filters
      if (criteria.businessName) {
        const nameLower = (businessAny.name || '').toLowerCase();
        const searchLower = criteria.businessName.toLowerCase();
        if (!nameLower.includes(searchLower)) {
          continue;
        }
      }

      if (criteria.sector) {
        const sectorLower = (businessAny.category || businessAny.sector || '').toLowerCase();
        const searchLower = criteria.sector.toLowerCase();
        if (!sectorLower.includes(searchLower)) {
          continue;
        }
      }

      if (criteria.location) {
        const loc = criteria.location;
        if (loc.city && businessAny.profile?.city && 
            !businessAny.profile.city.toLowerCase().includes(loc.city.toLowerCase())) {
          continue;
        }
        if (loc.region && businessAny.profile?.region && 
            !businessAny.profile.region.toLowerCase().includes(loc.region.toLowerCase())) {
          continue;
        }
        if (loc.postcode && businessAny.profile?.postcode && 
            !businessAny.profile.postcode.toLowerCase().includes(loc.postcode.toLowerCase())) {
          continue;
        }
      }

      // Fetch rewards and campaigns for this business
      const rewardIds = await redisClient.smembers(REDIS_KEYS.businessRewards(businessId)).catch(() => []);
      const campaignIds = await redisClient.smembers(REDIS_KEYS.businessCampaigns(businessId)).catch(() => []);

      const rewards = [];
      for (const rewardId of rewardIds.slice(0, 50)) {
        try {
          const reward = await redisClient.get(REDIS_KEYS.reward(rewardId));
          if (reward) {
            const parsedReward = JSON.parse(reward);
            if (!criteria.rewardsOnly || parsedReward.isActive) {
              rewards.push(parsedReward);
            }
          }
        } catch (err) {
          // Skip invalid rewards
        }
      }

      const campaigns = [];
      for (const campaignId of campaignIds.slice(0, 50)) {
        try {
          const campaign = await redisClient.get(REDIS_KEYS.campaign(campaignId));
          if (campaign) {
            const parsedCampaign = JSON.parse(campaign);
            if (!criteria.campaignsOnly || parsedCampaign.status === 'active') {
              campaigns.push(parsedCampaign);
            }
          }
        } catch (err) {
          // Skip invalid campaigns
        }
      }

      // Filter by rewardsOnly/campaignsOnly
      if (criteria.rewardsOnly && criteria.campaignsOnly) {
        // Both: must have at least one reward OR one campaign
        if (rewards.length === 0 && campaigns.length === 0) {
          continue;
        }
      } else if (criteria.rewardsOnly) {
        // Rewards only: must have at least one reward
        if (rewards.length === 0) {
          continue;
        }
      } else if (criteria.campaignsOnly) {
        // Campaigns only: must have at least one campaign
        if (campaigns.length === 0) {
          continue;
        }
      }

      // Build business result
      const businessResult: any = {
        id: businessId,
        name: businessAny.name || '',
        sector: businessAny.category || businessAny.sector || '',
        location: {
          country: businessAny.profile?.country || 'UK',
          region: businessAny.profile?.region || businessAny.address?.region || 'tees-valley',
          city: businessAny.profile?.city || businessAny.address?.city || '',
          street: businessAny.profile?.addressLine1 || businessAny.address?.line1 || '',
          postcode: businessAny.profile?.postcode || businessAny.address?.postcode || '',
          coordinates: {
            lat: 0,
            lng: 0,
          },
          formattedAddress: [
            businessAny.profile?.addressLine1 || businessAny.address?.line1,
            businessAny.profile?.city || businessAny.address?.city,
            businessAny.profile?.postcode || businessAny.address?.postcode,
          ].filter(Boolean).join(', '),
        },
        rewardsPrograms: rewards,
        campaigns: campaigns,
        status: businessAny.status || 'active',
        createdDate: new Date(businessAny.createdAt || Date.now()),
      };

      matchingBusinesses.push(businessResult);
    } catch (error) {
      // Skip invalid businesses
      continue;
    }
  }

  // Sort results
  if (criteria.sortBy === 'name') {
    matchingBusinesses.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Paginate
  const totalCount = matchingBusinesses.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedResults = matchingBusinesses.slice(start, end);

  const result: SearchResult = {
    results: paginatedResults,
    totalCount,
    page,
    hasMore: end < totalCount,
  };

  res.json({
    success: true,
    data: result,
  });
}));

/**
 * POST /api/v1/search/map
 * Map-based search for businesses within bounds
 */
router.post('/map', asyncHandler(async (req: Request, res: Response) => {
  await connectRedis();

  const { bounds, ...criteria }: { bounds: MapBounds } & SearchCriteria = req.body;

  // For now, use same logic as text search
  // In production, this would filter by geographic bounds
  // Get all business IDs
  let businessIds: string[] = [];
  
  try {
    const allBusinessIds = await redisClient.smembers('businesses:all');
    businessIds = allBusinessIds || [];
  } catch (error: any) {
    console.error('[SEARCH] Error fetching business IDs:', error);
    return res.json({
      success: true,
      data: {
        results: [],
        totalCount: 0,
      },
    });
  }

  const page = criteria.page || 1;
  const pageSize = criteria.pageSize || 20;

  // Fetch businesses (same logic as text search)
  const matchingBusinesses: Business[] = [];
  
  for (const businessId of businessIds.slice(0, 500)) {
    try {
      const businessAny = await redis.getBusiness(businessId) as any;
      if (!businessAny || !businessAny.status || businessAny.status.toLowerCase() !== 'active') {
        continue;
      }

      // Apply filters
      if (criteria.businessName) {
        const nameLower = (businessAny.name || '').toLowerCase();
        const searchLower = criteria.businessName.toLowerCase();
        if (!nameLower.includes(searchLower)) {
          continue;
        }
      }

      // Fetch rewards and campaigns
      const rewardIds = await redisClient.smembers(REDIS_KEYS.businessRewards(businessId)).catch(() => []);
      const campaignIds = await redisClient.smembers(REDIS_KEYS.businessCampaigns(businessId)).catch(() => []);

      const rewards = [];
      for (const rewardId of rewardIds.slice(0, 50)) {
        try {
          const reward = await redisClient.get(REDIS_KEYS.reward(rewardId));
          if (reward) {
            const parsedReward = JSON.parse(reward);
            if (!criteria.rewardsOnly || parsedReward.isActive) {
              rewards.push(parsedReward);
            }
          }
        } catch (err) {
          // Skip invalid rewards
        }
      }

      const campaigns = [];
      for (const campaignId of campaignIds.slice(0, 50)) {
        try {
          const campaign = await redisClient.get(REDIS_KEYS.campaign(campaignId));
          if (campaign) {
            const parsedCampaign = JSON.parse(campaign);
            if (!criteria.campaignsOnly || parsedCampaign.status === 'active') {
              campaigns.push(parsedCampaign);
            }
          }
        } catch (err) {
          // Skip invalid campaigns
        }
      }

      // Filter by rewardsOnly/campaignsOnly
      if (criteria.rewardsOnly && criteria.campaignsOnly) {
        if (rewards.length === 0 && campaigns.length === 0) {
          continue;
        }
      } else if (criteria.rewardsOnly) {
        if (rewards.length === 0) {
          continue;
        }
      } else if (criteria.campaignsOnly) {
        if (campaigns.length === 0) {
          continue;
        }
      }

      // Build business result
      const businessResult: any = {
        id: businessId,
        name: businessAny.name || '',
        sector: businessAny.category || businessAny.sector || '',
        location: {
          country: businessAny.profile?.country || 'UK',
          region: businessAny.profile?.region || 'tees-valley',
          city: businessAny.profile?.city || '',
          street: businessAny.profile?.addressLine1 || '',
          postcode: businessAny.profile?.postcode || '',
          coordinates: {
            lat: 0,
            lng: 0,
          },
          formattedAddress: [
            businessAny.profile?.addressLine1,
            businessAny.profile?.city,
            businessAny.profile?.postcode,
          ].filter(Boolean).join(', '),
        },
        rewardsPrograms: rewards,
        campaigns: campaigns,
        status: businessAny.status || 'active',
        createdDate: new Date(businessAny.createdAt || Date.now()),
      };

      matchingBusinesses.push(businessResult);
    } catch (error) {
      continue;
    }
  }

  // Sort results
  if (criteria.sortBy === 'name') {
    matchingBusinesses.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Paginate
  const totalCount = matchingBusinesses.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedResults = matchingBusinesses.slice(start, end);

  const result: SearchResult = {
    results: paginatedResults,
    totalCount,
    page,
    hasMore: end < totalCount,
  };

  res.json({
    success: true,
    data: result,
  });
}));

export default router;

