/**
 * Repository Copy Service
 * 
 * Saves copies of repository data to local files when clients upload to Redis.
 * Files are organized by business title for easy comparison with Redis entries.
 */

import * as fs from 'fs';
import * as path from 'path';
import { constants as fsConstants } from 'fs';
import { redis, REDIS_KEYS, redisClient } from '../config/redis';
import type { Business, Reward, Campaign, Member } from '../types';

// Repository copies directory
// On Vercel (serverless), use /tmp (ephemeral storage)
// On traditional servers, use project root
const REPO_COPIES_DIR = process.env.VERCEL 
  ? '/tmp/repo-copies'
  : path.join(process.cwd(), 'repo-copies');

/**
 * Sanitize business name for use as directory name
 */
const sanitizeBusinessName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50); // Limit length
};

/**
 * Ensure directory exists, create if it doesn't
 */
const ensureDirectory = (dirPath: string): void => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (error: any) {
    // On Vercel /tmp may not exist, create it
    if (error.code === 'ENOENT' && dirPath.startsWith('/tmp')) {
      try {
        fs.mkdirSync('/tmp', { recursive: true });
        fs.mkdirSync(dirPath, { recursive: true });
      } catch (retryError: any) {
        console.error(`❌ [REPO COPY] Failed to create directory ${dirPath}:`, retryError.message);
        throw retryError;
      }
    } else {
      throw error;
    }
  }
};

/**
 * Get business title from businessId
 */
const getBusinessTitle = async (businessId: string): Promise<string> => {
  try {
    const business = await redis.getBusiness(businessId);
    if (business && business.name) {
      return sanitizeBusinessName(business.name);
    }
  } catch (error) {
    console.error(`[REPO COPY] Error fetching business ${businessId}:`, error);
  }
  
  // Fallback to businessId if name not found
  return sanitizeBusinessName(`business-${businessId}`);
};

/**
 * Get business directory path
 */
const getBusinessDir = async (businessId: string): Promise<string> => {
  const businessTitle = await getBusinessTitle(businessId);
  const businessDir = path.join(REPO_COPIES_DIR, businessTitle);
  ensureDirectory(businessDir);
  return businessDir;
};

/**
 * Save complete repository state for a business
 */
export const saveRepositoryCopy = async (businessId: string): Promise<void> => {
  try {
    // On Vercel, only save if we have write access (skip if /tmp isn't available)
    if (process.env.VERCEL) {
      try {
        // Test if /tmp is writable
        fs.accessSync('/tmp', fsConstants.W_OK);
      } catch (error) {
        console.warn(`⚠️ [REPO COPY] /tmp not writable on Vercel, skipping repository copy`);
        return;
      }
    }
    
    console.log(`📁 [REPO COPY] Saving repository copy for business: ${businessId}`);
    
    // Ensure base directory exists before getting business dir
    try {
      ensureDirectory(REPO_COPIES_DIR);
    } catch (error: any) {
      console.warn(`⚠️ [REPO COPY] Failed to create base directory, skipping: ${error.message}`);
      return;
    }
    
    const businessDir = await getBusinessDir(businessId);
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    
    // Fetch all repository data from Redis
    const [business, rewardIds, campaignIds, memberIds] = await Promise.all([
      redis.getBusiness(businessId),
      redisClient.smembers(REDIS_KEYS.businessRewards(businessId)),
      redisClient.smembers(`business:${businessId}:campaigns`),
      redisClient.smembers(REDIS_KEYS.businessMembers(businessId)),
    ]);
    
    if (!business) {
      console.warn(`⚠️ [REPO COPY] Business ${businessId} not found in Redis`);
      return;
    }
    
    // Fetch all rewards
    const rewards = await Promise.all(
      rewardIds.map(async (id) => {
        const data = await redisClient.get(REDIS_KEYS.reward(id));
        return data ? JSON.parse(data) : null;
      })
    );
    
    // Fetch all campaigns
    const campaigns = await Promise.all(
      campaignIds.map(async (id) => {
        const data = await redisClient.get(REDIS_KEYS.campaign(id));
        return data ? JSON.parse(data) : null;
      })
    );
    
    // Fetch all members (customers)
    const members = await Promise.all(
      memberIds.map(async (id) => {
        try {
          return await redis.getMember(id);
        } catch (e) {
          return null;
        }
      })
    );
    
    // Build complete repository snapshot
    const repositoryCopy = {
      timestamp: new Date().toISOString(),
      businessId,
      businessName: business.name,
      business,
      rewards: rewards.filter(Boolean),
      campaigns: campaigns.filter(Boolean),
      members: members.filter(Boolean),
      metadata: {
        rewardsCount: rewards.filter(Boolean).length,
        campaignsCount: campaigns.filter(Boolean).length,
        membersCount: members.filter(Boolean).length,
        businessUpdatedAt: business.updatedAt,
      },
    };
    
    // Save complete repository copy
    const repoFilePath = path.join(businessDir, `repository-${timestamp}.json`);
    fs.writeFileSync(repoFilePath, JSON.stringify(repositoryCopy, null, 2));
    console.log(`✅ [REPO COPY] Repository copy saved to: ${repoFilePath}`);
    
    // Also save latest snapshot (overwrites previous latest)
    const latestFilePath = path.join(businessDir, 'repository-latest.json');
    fs.writeFileSync(latestFilePath, JSON.stringify(repositoryCopy, null, 2));
    console.log(`✅ [REPO COPY] Latest repository copy updated: ${latestFilePath}`);
    
    // Save individual entity files for easier comparison
    await saveIndividualEntities(businessDir, timestamp, {
      business,
      rewards: rewards.filter(Boolean),
      campaigns: campaigns.filter(Boolean),
      members: members.filter(Boolean),
    });
    
  } catch (error: any) {
    console.error(`❌ [REPO COPY] Error saving repository copy for business ${businessId}:`, error.message);
    // Don't throw - this is a background operation and shouldn't break API calls
  }
};

/**
 * Save individual entity files
 */
const saveIndividualEntities = async (
  businessDir: string,
  timestamp: string,
  entities: {
    business: Business;
    rewards: Reward[];
    campaigns: Campaign[];
    members: Member[];
  }
): Promise<void> => {
  const entitiesDir = path.join(businessDir, 'entities');
  ensureDirectory(entitiesDir);
  
  // Save business profile
  fs.writeFileSync(
    path.join(entitiesDir, `business-${timestamp}.json`),
    JSON.stringify(entities.business, null, 2)
  );
  fs.writeFileSync(
    path.join(entitiesDir, 'business-latest.json'),
    JSON.stringify(entities.business, null, 2)
  );
  
  // Save rewards
  fs.writeFileSync(
    path.join(entitiesDir, `rewards-${timestamp}.json`),
    JSON.stringify(entities.rewards, null, 2)
  );
  fs.writeFileSync(
    path.join(entitiesDir, 'rewards-latest.json'),
    JSON.stringify(entities.rewards, null, 2)
  );
  
  // Save campaigns
  fs.writeFileSync(
    path.join(entitiesDir, `campaigns-${timestamp}.json`),
    JSON.stringify(entities.campaigns, null, 2)
  );
  fs.writeFileSync(
    path.join(entitiesDir, 'campaigns-latest.json'),
    JSON.stringify(entities.campaigns, null, 2)
  );
  
  // Save members
  fs.writeFileSync(
    path.join(entitiesDir, `members-${timestamp}.json`),
    JSON.stringify(entities.members, null, 2)
  );
  fs.writeFileSync(
    path.join(entitiesDir, 'members-latest.json'),
    JSON.stringify(entities.members, null, 2)
  );
  
  console.log(`✅ [REPO COPY] Individual entity files saved to: ${entitiesDir}`);
};

/**
 * Save repository copy when a specific entity is updated
 * This is called from route handlers when data is uploaded
 */
export const saveEntityCopy = async (
  businessId: string,
  entityType: 'reward' | 'campaign' | 'member' | 'business',
  entityId?: string
): Promise<void> => {
  try {
    // Save complete repository copy (this ensures we capture all related data)
    await saveRepositoryCopy(businessId);
  } catch (error: any) {
    console.error(`❌ [REPO COPY] Error saving entity copy:`, error.message);
    // Don't throw - this shouldn't break API calls
  }
};

/**
 * Initialize repository copies directory
 * Only called on traditional servers, not on Vercel (serverless)
 * On Vercel, directories are created lazily when needed
 */
export const initializeRepositoryCopies = (): void => {
  // Skip initialization on Vercel - directories created lazily
  if (process.env.VERCEL) {
    console.log(`📁 [REPO COPY] Running on Vercel - repository copies will use /tmp (ephemeral)`);
    return;
  }
  
  try {
    ensureDirectory(REPO_COPIES_DIR);
    console.log(`📁 [REPO COPY] Repository copies directory initialized: ${REPO_COPIES_DIR}`);
  } catch (error: any) {
    console.warn(`⚠️ [REPO COPY] Failed to initialize directory (will create lazily): ${error.message}`);
  }
};

