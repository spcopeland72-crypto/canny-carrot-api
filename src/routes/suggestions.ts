/**
 * Autocomplete Suggestions Route
 * GET /api/v1/suggestions/{fieldType}?query={searchTerm}
 * 
 * Returns autocomplete suggestions for search fields.
 * For businessName fieldType, returns suggestions from active businesses in Redis.
 */

import { Router, Request, Response } from 'express';
import { redis, REDIS_KEYS, redisClient, connectRedis } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { Business } from '../types';

const router = Router();

type FieldType = 'businessName' | 'sector' | 'country' | 'region' | 'city' | 'street';

interface AutocompleteSuggestion {
  value: string;
  label: string;
  type: 'verified' | 'userSubmitted';
  metadata?: Record<string, any>;
}

/**
 * GET /api/v1/suggestions/:fieldType
 * Get autocomplete suggestions for a field type
 */
router.get('/:fieldType', asyncHandler(async (req: Request, res: Response) => {
  await connectRedis();
  
  const { fieldType } = req.params as { fieldType: FieldType };
  const query = (req.query.query as string) || '';
  const limit = parseInt(req.query.limit as string) || 10;

  // Only fetch businesses when user has entered at least 2 characters
  if (query.length < 2) {
    return res.json({
      success: true,
      data: {
        suggestions: [],
      },
    });
  }

  const queryLower = query.toLowerCase().trim();
  const suggestions: AutocompleteSuggestion[] = [];

  if (fieldType === 'businessName') {
    // Get all business IDs from Redis
    // Try businesses:all set first, if it exists
    let businessIds: string[] = [];
    
    try {
      const allBusinessIds = await redisClient.smembers('businesses:all');
      if (allBusinessIds && allBusinessIds.length > 0) {
        businessIds = allBusinessIds;
      } else {
        // Fallback: scan for business:* keys
        // Note: SCAN is expensive, so prefer using businesses:all set
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
          // Limit scan to prevent timeout (max 1000 businesses)
          if (keys.length >= 1000) break;
        } while (cursor !== '0');
        
        // Extract business IDs from keys (format: business:{id})
        businessIds = keys
          .map(key => key.replace('business:', ''))
          .filter(id => id.length > 0);
      }
    } catch (error: any) {
      console.error('[SUGGESTIONS] Error fetching business IDs:', error);
      // Continue with empty array - will return no suggestions
    }

    // Fetch businesses and filter for active ones
    const businesses: Business[] = [];
    
    for (const businessId of businessIds.slice(0, 100)) { // Limit to 100 to avoid timeout
      try {
        const business = await redis.getBusiness(businessId);
        // Check for active status (case-insensitive: 'active', 'ACTIVE', 'Active')
        if (business && business.status && business.status.toLowerCase() === 'active') {
          businesses.push(business);
        }
      } catch (error) {
        // Skip invalid businesses
        continue;
      }
    }

    // Filter businesses by name match - prioritize names starting with query (from first 2+ characters)
    const matchingBusinesses = businesses
      .filter(business => {
        const nameLower = business.name.toLowerCase();
        // Match if business name starts with the query (from first 2+ characters input)
        return nameLower.startsWith(queryLower) || nameLower.includes(queryLower);
      })
      .sort((a, b) => {
        // Prioritize exact start matches first (businesses starting with the query)
        const aStarts = a.name.toLowerCase().startsWith(queryLower);
        const bStarts = b.name.toLowerCase().startsWith(queryLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, limit); // Limit results

    // Convert to AutocompleteSuggestion format
    // Include address information in metadata so form can be populated
    suggestions.push(...matchingBusinesses.map(business => {
      // Handle both address structures: business.address or business.profile
      // Some businesses have address nested in profile object
      const businessAny = business as any;
      const addressData: any = business.address || businessAny.profile?.address || businessAny.profile;
      const address = addressData ? {
        street: (addressData.line1 || addressData.addressLine1 || '').trim(),
        city: (addressData.city || '').trim(),
        region: (addressData.region || 'tees-valley').trim(),
        postcode: (addressData.postcode || '').trim(),
        country: (addressData.country || 'UK').trim(),
      } : undefined;

      return {
        value: business.name,
        label: business.name,
        type: 'verified' as const,
        metadata: {
          businessId: business.id,
          category: business.category,
          address: address,
        },
      };
    }));
  } else {
    // For other field types (sector, country, region, city, street),
    // extract unique values from active businesses
    let businessIds: string[] = [];
    
    try {
      const allBusinessIds = await redisClient.smembers('businesses:all');
      businessIds = allBusinessIds || [];
    } catch (error) {
      // Fallback to empty array
    }

    const seenValues = new Set<string>();
    const fieldSuggestions: AutocompleteSuggestion[] = [];

    // Sample up to 100 businesses to extract field values
    for (const businessId of businessIds.slice(0, 100)) {
      try {
        const business = await redis.getBusiness(businessId);
        // Check for active status (case-insensitive: 'active', 'ACTIVE', 'Active')
        if (!business || !business.status || business.status.toLowerCase() !== 'active') continue;

        let fieldValue: string | undefined;

        switch (fieldType) {
          case 'sector':
            fieldValue = business.category;
            break;
          case 'country':
            fieldValue = 'United Kingdom'; // Default for Tees Valley businesses
            break;
          case 'region':
            fieldValue = business.address.region;
            break;
          case 'city':
            fieldValue = business.address.city;
            break;
          case 'street':
            fieldValue = business.address.line1;
            break;
        }

        if (fieldValue && !seenValues.has(fieldValue.toLowerCase())) {
          const valueLower = fieldValue.toLowerCase();
          if (valueLower.includes(queryLower)) {
            seenValues.add(valueLower);
            fieldSuggestions.push({
              value: fieldValue,
              label: fieldValue,
              type: 'verified' as const,
            });
            
            if (fieldSuggestions.length >= limit) break;
          }
        }
      } catch (error) {
        continue;
      }
    }

    suggestions.push(...fieldSuggestions);
  }

  // Sort suggestions by relevance (exact match first, then partial matches)
  suggestions.sort((a, b) => {
    const aLower = a.value.toLowerCase();
    const bLower = b.value.toLowerCase();
    const aStarts = aLower.startsWith(queryLower);
    const bStarts = bLower.startsWith(queryLower);
    
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.value.localeCompare(b.value);
  });

  res.json({
    success: true,
    data: {
      suggestions: suggestions.slice(0, limit),
    },
  });
}));

export default router;

