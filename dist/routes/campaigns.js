"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const redis_1 = require("../config/redis");
const errorHandler_1 = require("../middleware/errorHandler");
const repositoryCopyService_1 = require("../services/repositoryCopyService");
const router = (0, express_1.Router)();
// GET /api/v1/campaigns - Get all campaigns for a business
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { businessId, status } = req.query;
    if (!businessId) {
        throw new errorHandler_1.ApiError(400, 'Business ID is required');
    }
    const campaignIds = await redis_1.redisClient.smembers(`business:${businessId}:campaigns`);
    const campaigns = await Promise.all(campaignIds.map(async (id) => {
        const data = await redis_1.redisClient.get(redis_1.REDIS_KEYS.campaign(id));
        return data ? JSON.parse(data) : null;
    }));
    let filteredCampaigns = campaigns.filter(c => c !== null);
    if (status) {
        filteredCampaigns = filteredCampaigns.filter(c => c.status === status);
    }
    // Sort by start date descending
    filteredCampaigns.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    res.json({
        success: true,
        data: filteredCampaigns,
    });
}));
// GET /api/v1/campaigns/:id
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const data = await redis_1.redisClient.get(redis_1.REDIS_KEYS.campaign(id));
    if (!data) {
        throw new errorHandler_1.ApiError(404, 'Campaign not found');
    }
    const campaign = JSON.parse(data);
    // Get campaign stats
    const impressions = await redis_1.redisClient.get(`campaign:${id}:impressions`) || '0';
    const clicks = await redis_1.redisClient.get(`campaign:${id}:clicks`) || '0';
    const conversions = await redis_1.redisClient.get(`campaign:${id}:conversions`) || '0';
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
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { businessId, name, description, type, startDate, endDate, targetAudience = 'all', conditions = {}, notificationMessage, bonusStamps, discountPercent, } = req.body;
    if (!businessId || !name || !type || !startDate || !endDate) {
        throw new errorHandler_1.ApiError(400, 'Business ID, name, type, startDate, and endDate are required');
    }
    // Validate business exists
    const business = await redis_1.redis.getBusiness(businessId);
    if (!business) {
        throw new errorHandler_1.ApiError(404, 'Business not found');
    }
    // Use provided ID if present (for sync), otherwise generate new UUID
    const id = req.body.id && typeof req.body.id === 'string' ? req.body.id : (0, uuid_1.v4)();
    const now = new Date().toISOString();
    const campaign = {
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
    await redis_1.redisClient.set(redis_1.REDIS_KEYS.campaign(id), JSON.stringify(campaign));
    // Add to business's campaign list
    await redis_1.redisClient.sadd(`business:${businessId}:campaigns`, id);
    // If scheduled, add to scheduler queue
    if (campaign.status === 'scheduled') {
        await redis_1.redisClient.zadd('campaigns:scheduled', new Date(startDate).getTime(), id);
    }
    // If active and has notification, queue for sending
    if (campaign.status === 'active' && notificationMessage) {
        await queueNotifications(businessId, campaign);
    }
    // Save repository copy when campaign is created
    (0, repositoryCopyService_1.saveEntityCopy)(businessId, 'campaign', id).catch(err => {
        console.error('[CAMPAIGNS] Error saving repository copy:', err);
    });
    res.status(201).json({
        success: true,
        data: campaign,
    });
}));
// PUT /api/v1/campaigns/:id
router.put('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const data = await redis_1.redisClient.get(redis_1.REDIS_KEYS.campaign(id));
    if (!data) {
        throw new errorHandler_1.ApiError(404, 'Campaign not found');
    }
    const campaign = JSON.parse(data);
    // Can't update completed campaigns
    if (campaign.status === 'completed') {
        throw new errorHandler_1.ApiError(400, 'Cannot update completed campaigns');
    }
    // API is a transparent forwarder - preserve updatedAt from request, or keep existing
    // Do NOT auto-update timestamps - app manages timestamps
    const updatedCampaign = {
        ...campaign,
        ...updates,
        updatedAt: updates.updatedAt !== undefined ? updates.updatedAt : campaign.updatedAt, // Preserve from request or existing
    };
    await redis_1.redisClient.set(redis_1.REDIS_KEYS.campaign(id), JSON.stringify(updatedCampaign));
    // Ensure campaign is in business's campaign set (in case it was deleted from set)
    const businessId = updatedCampaign.businessId || campaign.businessId;
    if (businessId) {
        await redis_1.redisClient.sadd(`business:${businessId}:campaigns`, id);
    }
    // Save repository copy when campaign is updated
    (0, repositoryCopyService_1.saveEntityCopy)(campaign.businessId, 'campaign', id).catch(err => {
        console.error('[CAMPAIGNS] Error saving repository copy:', err);
    });
    res.json({
        success: true,
        data: updatedCampaign,
    });
}));
// PUT /api/v1/campaigns/:id/status
router.put('/:id/status', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'].includes(status)) {
        throw new errorHandler_1.ApiError(400, 'Invalid status');
    }
    const data = await redis_1.redisClient.get(redis_1.REDIS_KEYS.campaign(id));
    if (!data) {
        throw new errorHandler_1.ApiError(404, 'Campaign not found');
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
    await redis_1.redisClient.set(redis_1.REDIS_KEYS.campaign(id), JSON.stringify(campaign));
    res.json({
        success: true,
        data: campaign,
        message: `Campaign status updated to ${status}`,
    });
}));
// DELETE /api/v1/campaigns/:id
router.delete('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const data = await redis_1.redisClient.get(redis_1.REDIS_KEYS.campaign(id));
    if (!data) {
        throw new errorHandler_1.ApiError(404, 'Campaign not found');
    }
    const campaign = JSON.parse(data);
    // Remove from business's campaign list
    await redis_1.redisClient.srem(`business:${campaign.businessId}:campaigns`, id);
    // Remove from scheduled queue if present
    await redis_1.redisClient.zrem('campaigns:scheduled', id);
    // Delete campaign data
    await redis_1.redisClient.del(redis_1.REDIS_KEYS.campaign(id));
    await redis_1.redisClient.del(`campaign:${id}:impressions`);
    await redis_1.redisClient.del(`campaign:${id}:clicks`);
    await redis_1.redisClient.del(`campaign:${id}:conversions`);
    res.json({
        success: true,
        message: 'Campaign deleted',
    });
}));
// Helper: Queue notifications for campaign
async function queueNotifications(businessId, campaign) {
    const customerIds = await redis_1.redisClient.smembers(redis_1.REDIS_KEYS.businessCustomers(businessId));
    for (const customerId of customerIds) {
        const customer = await redis_1.redis.getCustomer(customerId);
        if (customer && customer.preferences?.notifications) {
            // Check target audience
            let shouldNotify = true;
            if (campaign.targetAudience === 'new') {
                // Only new customers (joined in last 30 days)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                shouldNotify = new Date(customer.createdAt) > thirtyDaysAgo;
            }
            else if (campaign.targetAudience === 'returning') {
                // Only returning customers (more than 3 visits)
                shouldNotify = (customer.totalStamps || 0) >= 3;
            }
            else if (campaign.targetAudience === 'inactive') {
                // Only inactive (no stamps in 30 days)
                const lastStamp = await redis_1.redisClient.lindex(redis_1.REDIS_KEYS.customerStamps(customerId, businessId), 0);
                if (lastStamp) {
                    const stamp = JSON.parse(lastStamp);
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    shouldNotify = new Date(stamp.issuedAt) < thirtyDaysAgo;
                }
                else {
                    shouldNotify = true; // Never visited
                }
            }
            if (shouldNotify) {
                // Queue notification
                await redis_1.redisClient.lpush('notifications:queue', JSON.stringify({
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
router.get('/active/customer/:customerId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { customerId } = req.params;
    const customer = await redis_1.redis.getCustomer(customerId);
    if (!customer) {
        throw new errorHandler_1.ApiError(404, 'Customer not found');
    }
    // Get all businesses the customer has visited
    const businessIds = await redis_1.redisClient.smembers(`customer:${customerId}:businesses`);
    const activeCampaigns = [];
    for (const businessId of businessIds) {
        const campaignIds = await redis_1.redisClient.smembers(`business:${businessId}:campaigns`);
        for (const campaignId of campaignIds) {
            const data = await redis_1.redisClient.get(redis_1.REDIS_KEYS.campaign(campaignId));
            if (data) {
                const campaign = JSON.parse(data);
                if (campaign.status === 'active') {
                    const business = await redis_1.redis.getBusiness(businessId);
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
exports.default = router;
//# sourceMappingURL=campaigns.js.map