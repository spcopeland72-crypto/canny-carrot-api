import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, REDIS_KEYS, redisClient } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { Campaign } from '../types';
import { saveEntityCopy } from '../services/repositoryCopyService';

const router = Router();

// GET /api/v1/campaigns - Get all campaigns for a business
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { businessId, status } = req.query;
  
  if (!businessId) {
    throw new ApiError(400, 'Business ID is required');
  }
  
  const campaignIds = await redisClient.smembers(`business:${businessId}:campaigns`);
  
  const campaigns = await Promise.all(
    campaignIds.map(async (id) => {
      const data = await redisClient.get(REDIS_KEYS.campaign(id));
      return data ? JSON.parse(data) : null;
    })
  );
  
  let filteredCampaigns = campaigns.filter(c => c !== null);
  
  if (status) {
    filteredCampaigns = filteredCampaigns.filter(c => c.status === status);
  }
  
  // Sort by start date descending
  filteredCampaigns.sort((a, b) => 
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
  
  res.json({
    success: true,
    data: filteredCampaigns,
  });
}));

// GET /api/v1/campaigns/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const data = await redisClient.get(REDIS_KEYS.campaign(id));
  if (!data) {
    throw new ApiError(404, 'Campaign not found');
  }
  
  const campaign = JSON.parse(data);
  
  // Get campaign stats
  const impressions = await redisClient.get(`campaign:${id}:impressions`) || '0';
  const clicks = await redisClient.get(`campaign:${id}:clicks`) || '0';
  const conversions = await redisClient.get(`campaign:${id}:conversions`) || '0';
  
  res.json({
    success: true,
    data: {
      ...campaign,
      stats: {
        impressions: parseInt(impressions),
        clicks: parseInt(clicks),
        conversions: parseInt(conversions),
        conversionRate: parseInt(impressions) > 0 
          ? ((parseInt(conversions) / parseInt(impressions)) * 100).toFixed(2) + '%'
          : '0%',
      },
    },
  });
}));

// POST /api/v1/campaigns - Create a new campaign
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    businessId,
    name,
    description,
    type,
    startDate,
    endDate,
    targetAudience = 'all',
    conditions = {},
    notificationMessage,
    bonusStamps,
    discountPercent,
  } = req.body;
  
  if (!businessId || !name || !type || !startDate || !endDate) {
    throw new ApiError(400, 'Business ID, name, type, startDate, and endDate are required');
  }
  
  // Validate business exists
  const business = await redis.getBusiness(businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const campaign: Campaign = {
    id,
    businessId,
    name,
    description: description || '',
    type, // 'double_stamps' | 'bonus_reward' | 'flash_sale' | 'referral' | 'birthday'
    startDate,
    endDate,
    status: new Date(startDate) > new Date() ? 'scheduled' : 'active',
    targetAudience,
    conditions: {
      ...conditions,
      bonusStamps,
      discountPercent,
    },
    notificationMessage,
    createdAt: now,
    updatedAt: now,
    stats: {
      impressions: 0,
      clicks: 0,
      conversions: 0,
    },
  };
  
  // Store campaign
  await redisClient.set(REDIS_KEYS.campaign(id), JSON.stringify(campaign));
  
  // Add to business's campaign list
  await redisClient.sadd(`business:${businessId}:campaigns`, id);
  
  // If scheduled, add to scheduler queue
  if (campaign.status === 'scheduled') {
    await redisClient.zadd('campaigns:scheduled', new Date(startDate).getTime(), id);
  }
  
  // If active and has notification, queue for sending
  if (campaign.status === 'active' && notificationMessage) {
    await queueNotifications(businessId, campaign);
  }
  
  // Save repository copy when campaign is created
  saveEntityCopy(businessId, 'campaign', id).catch(err => {
    console.error('[CAMPAIGNS] Error saving repository copy:', err);
  });
  
  res.status(201).json({
    success: true,
    data: campaign,
  });
}));

// PUT /api/v1/campaigns/:id
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  const data = await redisClient.get(REDIS_KEYS.campaign(id));
  if (!data) {
    throw new ApiError(404, 'Campaign not found');
  }
  
  const campaign = JSON.parse(data);
  
  // Can't update completed campaigns
  if (campaign.status === 'completed') {
    throw new ApiError(400, 'Cannot update completed campaigns');
  }
  
  const updatedCampaign = {
    ...campaign,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await redisClient.set(REDIS_KEYS.campaign(id), JSON.stringify(updatedCampaign));
  
  // Save repository copy when campaign is updated
  saveEntityCopy(campaign.businessId, 'campaign', id).catch(err => {
    console.error('[CAMPAIGNS] Error saving repository copy:', err);
  });
  
  res.json({
    success: true,
    data: updatedCampaign,
  });
}));

// PUT /api/v1/campaigns/:id/status
router.put('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'].includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }
  
  const data = await redisClient.get(REDIS_KEYS.campaign(id));
  if (!data) {
    throw new ApiError(404, 'Campaign not found');
  }
  
  const campaign = JSON.parse(data);
  
  // Update status
  campaign.status = status;
  campaign.updatedAt = new Date().toISOString();
  
  // If activating, send notifications
  if (status === 'active' && campaign.notificationMessage) {
    await queueNotifications(campaign.businessId, campaign);
  }
  
  await redisClient.set(REDIS_KEYS.campaign(id), JSON.stringify(campaign));
  
  res.json({
    success: true,
    data: campaign,
    message: `Campaign status updated to ${status}`,
  });
}));

// DELETE /api/v1/campaigns/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const data = await redisClient.get(REDIS_KEYS.campaign(id));
  if (!data) {
    throw new ApiError(404, 'Campaign not found');
  }
  
  const campaign = JSON.parse(data);
  
  // Remove from business's campaign list
  await redisClient.srem(`business:${campaign.businessId}:campaigns`, id);
  
  // Remove from scheduled queue if present
  await redisClient.zrem('campaigns:scheduled', id);
  
  // Delete campaign data
  await redisClient.del(REDIS_KEYS.campaign(id));
  await redisClient.del(`campaign:${id}:impressions`);
  await redisClient.del(`campaign:${id}:clicks`);
  await redisClient.del(`campaign:${id}:conversions`);
  
  res.json({
    success: true,
    message: 'Campaign deleted',
  });
}));

// Helper: Queue notifications for campaign
async function queueNotifications(businessId: string, campaign: Campaign) {
  const memberIds = await redisClient.smembers(REDIS_KEYS.businessMembers(businessId));
  
  for (const memberId of memberIds) {
    const member = await redis.getMember(memberId);
    if (member && member.preferences?.notifications) {
      // Check target audience
      let shouldNotify = true;
      
      if (campaign.targetAudience === 'new') {
        // Only new members (joined in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        shouldNotify = new Date(member.createdAt) > thirtyDaysAgo;
      } else if (campaign.targetAudience === 'returning') {
        // Only returning members (more than 3 visits)
        shouldNotify = (member.totalStamps || 0) >= 3;
      } else if (campaign.targetAudience === 'inactive') {
        // Only inactive (no stamps in 30 days)
        const lastStamp = await redisClient.lindex(
          REDIS_KEYS.memberStamps(memberId, businessId), 
          0
        );
        if (lastStamp) {
          const stamp = JSON.parse(lastStamp);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          shouldNotify = new Date(stamp.issuedAt) < thirtyDaysAgo;
        } else {
          shouldNotify = true; // Never visited
        }
      }
      
      if (shouldNotify) {
        // Queue notification
        await redisClient.lpush('notifications:queue', JSON.stringify({
          type: 'campaign',
          memberId,
          campaignId: campaign.id,
          businessId,
          title: campaign.name,
          message: campaign.notificationMessage,
          data: {
            type: campaign.type,
            conditions: campaign.conditions,
          },
          createdAt: new Date().toISOString(),
        }));
      }
    }
  }
}

// GET /api/v1/campaigns/active/member/:memberId
// Get active campaigns relevant to a member
router.get('/active/member/:memberId', asyncHandler(async (req: Request, res: Response) => {
  const { memberId } = req.params;
  
  const member = await redis.getMember(memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  // Get all businesses the member has visited
  const businessIds = await redisClient.smembers(`member:${memberId}:businesses`);
  
  const activeCampaigns = [];
  
  for (const businessId of businessIds) {
    const campaignIds = await redisClient.smembers(`business:${businessId}:campaigns`);
    
    for (const campaignId of campaignIds) {
      const data = await redisClient.get(REDIS_KEYS.campaign(campaignId));
      if (data) {
        const campaign = JSON.parse(data);
        if (campaign.status === 'active') {
          const business = await redis.getBusiness(businessId);
          activeCampaigns.push({
            ...campaign,
            businessName: business?.name,
            businessLogo: business?.logo,
          });
        }
      }
    }
  }
  
  res.json({
    success: true,
    data: activeCampaigns,
  });
}));

export default router;




















