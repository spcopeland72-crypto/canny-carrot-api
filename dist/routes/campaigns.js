"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const redis_1 = require("../config/redis");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();

/**
 * CAMPAIGNS API - STRICT PASS-THROUGH ONLY
 * App ↔ Redis ↔ App. No creating, transforming, or adding data.
 * Store and return exactly what the app sends.
 */

// GET /api/v1/campaigns - List campaigns for a business (from Redis, unchanged)
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
    filteredCampaigns.sort((a, b) => {
        const ta = a.startDate ? new Date(a.startDate).getTime() : 0;
        const tb = b.startDate ? new Date(b.startDate).getTime() : 0;
        return tb - ta;
    });
    res.json({
        success: true,
        data: filteredCampaigns,
    });
}));

// GET /api/v1/campaigns/:id - Get single campaign (from Redis, unchanged)
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const data = await redis_1.redisClient.get(redis_1.REDIS_KEYS.campaign(id));
    if (!data) {
        throw new errorHandler_1.ApiError(404, 'Campaign not found');
    }
    const campaign = JSON.parse(data);
    res.json({
        success: true,
        data: campaign,
    });
}));

// POST /api/v1/campaigns - Store campaign exactly as sent (pass-through)
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const id = body.id;
    const businessId = body.businessId;
    if (!id || !businessId) {
        throw new errorHandler_1.ApiError(400, 'Request body must include id and businessId');
    }
    await redis_1.redisClient.set(redis_1.REDIS_KEYS.campaign(id), JSON.stringify(body));
    await redis_1.redisClient.sadd(`business:${businessId}:campaigns`, id);
    res.status(201).json({
        success: true,
        data: body,
    });
}));

// PUT /api/v1/campaigns/:id - Overwrite campaign with body exactly as sent (pass-through)
router.put('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const existing = await redis_1.redisClient.get(redis_1.REDIS_KEYS.campaign(id));
    if (!existing) {
        throw new errorHandler_1.ApiError(404, 'Campaign not found');
    }
    const businessId = body.businessId || JSON.parse(existing).businessId;
    if (!businessId) {
        throw new errorHandler_1.ApiError(400, 'Request body must include businessId');
    }
    await redis_1.redisClient.set(redis_1.REDIS_KEYS.campaign(id), JSON.stringify(body));
    await redis_1.redisClient.sadd(`business:${businessId}:campaigns`, id);
    res.json({
        success: true,
        data: body,
    });
}));

// DELETE /api/v1/campaigns/:id - Remove campaign (pass-through)
router.delete('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const data = await redis_1.redisClient.get(redis_1.REDIS_KEYS.campaign(id));
    if (!data) {
        throw new errorHandler_1.ApiError(404, 'Campaign not found');
    }
    const campaign = JSON.parse(data);
    await redis_1.redisClient.srem(`business:${campaign.businessId}:campaigns`, id);
    await redis_1.redisClient.del(redis_1.REDIS_KEYS.campaign(id));
    res.json({
        success: true,
        message: 'Campaign deleted',
    });
}));

// GET /api/v1/campaigns/active/customer/:customerId - Active campaigns for customer (from Redis only, no enrichment)
router.get('/active/customer/:customerId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { customerId } = req.params;
    const customer = await redis_1.redis.getCustomer(customerId);
    if (!customer) {
        throw new errorHandler_1.ApiError(404, 'Customer not found');
    }
    const businessIds = await redis_1.redisClient.smembers(`customer:${customerId}:businesses`).catch(() => []);
    const activeCampaigns = [];
    for (const businessId of businessIds) {
        const campaignIds = await redis_1.redisClient.smembers(`business:${businessId}:campaigns`);
        for (const campaignId of campaignIds) {
            const data = await redis_1.redisClient.get(redis_1.REDIS_KEYS.campaign(campaignId));
            if (data) {
                const campaign = JSON.parse(data);
                if (campaign.status === 'active') {
                    activeCampaigns.push(campaign);
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
