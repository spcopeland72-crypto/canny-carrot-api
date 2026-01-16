import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, REDIS_KEYS, redisClient } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { Campaign, ApiResponse } from '../types';
import { saveEntityCopy } from '../services/repositoryCopyService';
import { captureClientUpload, captureServerDownload } from '../services/debugCaptureService';

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
  
  // Capture server download for debugging
  captureServerDownload('campaigns', businessId as string, filteredCampaigns).catch(err => 
    console.error('[DEBUG] Error capturing server download:', err)
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
  // Accept full campaign object from client - API is a transparent forwarder
  const { id, businessId, name } = req.body;
  
  // Capture client upload for debugging
  if (businessId) {
    captureClientUpload('campaign', businessId, req.body).catch(err => 
      console.error('[DEBUG] Error capturing client upload:', err)
    );
  }
  
  console.log('\n🥕 ============================================');
  console.log('🥕 CAMPAIGN CREATION REQUEST');
  console.log('🥕 ============================================');
  console.log('📋 Campaign Name:', name);
  console.log('📋 Business ID:', businessId);
  console.log('📋 Campaign ID:', id);
  console.log('🥕 ============================================\n');
  
  if (!businessId || !name) {
    console.error('❌ [CAMPAIGNS] Missing required fields:', { businessId: !!businessId, name: !!name });
    throw new ApiError(400, 'Business ID and name are mandatory');
  }
  
  // Verify business exists
  const business = await redis.getBusiness(businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  // Use provided ID if valid, otherwise generate new one
  // This allows app to sync campaigns with existing IDs
  const campaignId = id && typeof id === 'string' && id.length > 0 ? id : uuidv4();
  const now = new Date().toISOString();
  
  // Check if campaign with this ID already exists (for idempotency)
  const existingCampaignData = await redisClient.get(REDIS_KEYS.campaign(campaignId));
  if (existingCampaignData) {
    // Campaign exists - API is transparent pipe, store exactly what app sends (full replacement)
    // App must send complete campaign record
    const campaign: any = {
      ...req.body, // Include ALL fields from request (complete record)
      id: campaignId, // Ensure ID can't be changed
      businessId: existingCampaignData ? JSON.parse(existingCampaignData).businessId : businessId, // Preserve businessId
      createdAt: req.body.createdAt || JSON.parse(existingCampaignData).createdAt || now, // Preserve or use provided
      updatedAt: req.body.updatedAt || now, // Use provided or current time
    };
    
    await redisClient.set(REDIS_KEYS.campaign(campaignId), JSON.stringify(campaign));
    
    // Ensure it's in the business campaigns set
    await redisClient.sadd(`business:${businessId}:campaigns`, campaignId);
    
    // API is a transparent forwarder - does not modify business.updatedAt
    // App is responsible for updating business profile timestamp when syncing
    
    // Save repository copy when campaign is updated
    saveEntityCopy(businessId, 'campaign', campaignId).catch(err => {
      console.error('[CAMPAIGNS] Error saving repository copy:', err);
    });
    
    return res.json({
      success: true,
      data: campaign,
    });
  }
  
  // API is a transparent forwarder - use request body as-is, only set defaults for required fields
  // Do NOT auto-update timestamps - app manages timestamps
  const campaign: any = {
    ...req.body, // Include ALL fields from request (conditions.rewardData, selectedProducts, pinCode, qrCode, timestamps, etc.)
    id: campaignId,
    businessId,
    createdAt: req.body.createdAt || now, // Only set if not provided
    updatedAt: req.body.updatedAt || now, // Only set if not provided
    status: req.body.status !== undefined ? req.body.status : (new Date(req.body.startDate) > new Date() ? 'scheduled' : 'active'),
    targetAudience: req.body.targetAudience !== undefined ? req.body.targetAudience : 'all',
    stats: req.body.stats !== undefined ? req.body.stats : {
      impressions: 0,
      clicks: 0,
      conversions: 0,
    },
  };
  
    // Store campaign
    await redisClient.set(REDIS_KEYS.campaign(campaignId), JSON.stringify(campaign));
    
    // Capture what was saved to Redis for debugging
    captureClientUpload('campaign', businessId, campaign).catch(err => 
      console.error('[DEBUG] Error capturing saved campaign:', err)
    );
    
    // Add to business's campaign set
    await redisClient.sadd(`business:${businessId}:campaigns`, campaignId);
  
    // API is a transparent forwarder - does not modify business stats or timestamps
    // App is responsible for updating business profile and stats when syncing
    
    // Save repository copy when campaign is created
    saveEntityCopy(businessId, 'campaign', campaignId).catch(err => {
      console.error('[CAMPAIGNS] Error saving repository copy:', err);
    });
    
    const response: ApiResponse<any> = {
      success: true,
      data: campaign,
    };
    
    res.status(201).json(response);
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
  
  // Capture client upload for debugging
  captureClientUpload('campaign', campaign.businessId, req.body).catch(err => 
    console.error('[DEBUG] Error capturing client upload:', err)
  );
  
  // Can't update completed campaigns
  if (campaign.status === 'completed') {
    throw new ApiError(400, 'Cannot update completed campaigns');
  }
  
  // API is a transparent forwarder - preserve updatedAt from request, or keep existing
  // Do NOT auto-update timestamps - app manages timestamps
  const updatedCampaign = {
    ...campaign,
    ...updates,
    updatedAt: updates.updatedAt !== undefined ? updates.updatedAt : campaign.updatedAt, // Preserve from request or existing
  };
  
  await redisClient.set(REDIS_KEYS.campaign(id), JSON.stringify(updatedCampaign));
  
  // Capture what was saved to Redis for debugging
  captureClientUpload('campaign', campaign.businessId, updatedCampaign).catch(err => 
    console.error('[DEBUG] Error capturing saved campaign:', err)
  );
  
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
  
  // API is a transparent forwarder - preserve updatedAt from request, or keep existing
  // Do NOT auto-update timestamps - admin/client manages timestamps
  campaign.status = status;
  campaign.updatedAt = req.body.updatedAt !== undefined ? req.body.updatedAt : campaign.updatedAt; // Preserve from request or existing
  
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
  const customerIds = await redisClient.smembers(REDIS_KEYS.businessCustomers(businessId));
  
  for (const customerId of customerIds) {
    const customer = await redis.getCustomer(customerId);
    if (customer && customer.preferences?.notifications) {
      // Check target audience
      let shouldNotify = true;
      
      if (campaign.targetAudience === 'new') {
        // Only new customers (joined in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        shouldNotify = new Date(customer.createdAt) > thirtyDaysAgo;
      } else if (campaign.targetAudience === 'returning') {
        // Only returning customers (more than 3 visits)
        shouldNotify = (customer.totalStamps || 0) >= 3;
      } else if (campaign.targetAudience === 'inactive') {
        // Only inactive (no stamps in 30 days)
        const lastStamp = await redisClient.lindex(
          REDIS_KEYS.customerStamps(customerId, businessId), 
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
          customerId,
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

// GET /api/v1/campaigns/active/customer/:customerId
// Get active campaigns relevant to a customer
router.get('/active/customer/:customerId', asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  
  const customer = await redis.getCustomer(customerId);
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }
  
  // Get all businesses the customer has visited
  const businessIds = await redisClient.smembers(`customer:${customerId}:businesses`);
  
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




















