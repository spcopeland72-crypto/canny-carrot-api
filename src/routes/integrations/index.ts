// E-Commerce Integrations Router
// Aggregates all platform-specific routes

import { Router, Request, Response } from 'express';
import shopifyRoutes from './shopify.routes';
import ebayRoutes from './ebay.routes';
import woocommerceRoutes from './woocommerce.routes';
import { asyncHandler } from '../../middleware/errorHandler';
import { redisClient } from '../../config/redis';
import { ECOMMERCE_REDIS_KEYS, EcommercePlatform } from '../../types/ecommerce';

const router = Router();

// ============================================
// AVAILABLE PLATFORMS
// ============================================

interface PlatformInfo {
  id: EcommercePlatform;
  name: string;
  description: string;
  status: 'available' | 'coming_soon' | 'manual_only';
  icon: string;
  setupTime: string;
  features: string[];
}

const PLATFORMS: PlatformInfo[] = [
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Connect your Shopify store to automatically issue stamps for online orders.',
    status: 'available',
    icon: '🛍️',
    setupTime: '< 5 minutes',
    features: [
      'Automatic stamp issuance',
      'Real-time order sync',
      'Customer matching',
      'Order value thresholds',
    ],
  },
  {
    id: 'amazon',
    name: 'Amazon Marketplace',
    description: 'Connect your Amazon Seller Central account for third-party sales.',
    status: 'coming_soon',
    icon: '📦',
    setupTime: '< 10 minutes',
    features: [
      'Amazon UK Marketplace',
      'Seller Central integration',
      'FBA & FBM orders',
      'Order notifications',
    ],
  },
  {
    id: 'amazon_stores',
    name: 'Amazon Stores',
    description: 'Link your Amazon Brand Store to reward customers.',
    status: 'coming_soon',
    icon: '🏬',
    setupTime: '< 10 minutes',
    features: [
      'Brand Store integration',
      'Brand Analytics access',
      'Customer insights',
      'Order tracking',
    ],
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    description: 'Integrate with your WordPress WooCommerce store.',
    status: 'available',
    icon: '🛒',
    setupTime: '< 10 minutes',
    features: [
      'OAuth 1.0a connection',
      'Automatic stamps',
      'Order webhooks',
      'Real-time sync',
    ],
  },
  {
    id: 'ebay',
    name: 'eBay',
    description: 'Connect your eBay UK seller account.',
    status: 'available',
    icon: '🏪',
    setupTime: '< 10 minutes',
    features: [
      'eBay UK marketplace',
      'Order sync (polling)',
      'Seller account linking',
      'FBA & merchant fulfilled',
    ],
  },
  {
    id: 'etsy',
    name: 'Etsy',
    description: 'Link your Etsy shop to reward your customers.',
    status: 'coming_soon',
    icon: '🎨',
    setupTime: '< 10 minutes',
    features: [
      'Etsy shop connection',
      'Order polling',
      'Handmade business support',
    ],
  },
  {
    id: 'vinted',
    name: 'Vinted',
    description: 'Track Vinted sales manually (no API available).',
    status: 'manual_only',
    icon: '👗',
    setupTime: '< 1 minute per sale',
    features: [
      'Manual order entry',
      'Sales tracking',
      'Customer rewards',
    ],
  },
];

// ============================================
// GENERAL INTEGRATION ROUTES
// ============================================

/**
 * GET /api/v1/integrations/platforms
 * List all available e-commerce platforms
 */
router.get('/platforms', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: PLATFORMS,
  });
});

/**
 * GET /api/v1/integrations/connections
 * Get all e-commerce connections for a business
 */
router.get('/connections', asyncHandler(async (req: Request, res: Response) => {
  const { businessId } = req.query;
  
  if (!businessId) {
    return res.status(400).json({
      success: false,
      error: 'businessId is required',
    });
  }
  
  const connectionIds = await redisClient.smembers(
    ECOMMERCE_REDIS_KEYS.businessConnections(businessId as string)
  );
  
  const connections = await Promise.all(
    connectionIds.map(async (id) => {
      const data = await redisClient.get(ECOMMERCE_REDIS_KEYS.connection(id));
      if (!data) return null;
      
      const conn = JSON.parse(data);
      // Remove sensitive data
      delete conn.accessToken;
      delete conn.refreshToken;
      delete conn.webhookSecret;
      return conn;
    })
  );
  
  res.json({
    success: true,
    data: connections.filter(c => c !== null),
  });
}));

/**
 * GET /api/v1/integrations/stats
 * Get integration statistics for a business
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const { businessId } = req.query;
  
  if (!businessId) {
    return res.status(400).json({
      success: false,
      error: 'businessId is required',
    });
  }
  
  const connectionIds = await redisClient.smembers(
    ECOMMERCE_REDIS_KEYS.businessConnections(businessId as string)
  );
  
  let totalOrdersSynced = 0;
  let totalStampsIssued = 0;
  let totalUnmatchedOrders = 0;
  const platformStats: Record<string, any> = {};
  
  for (const id of connectionIds) {
    const data = await redisClient.get(ECOMMERCE_REDIS_KEYS.connection(id));
    if (!data) continue;
    
    const conn = JSON.parse(data);
    totalOrdersSynced += conn.syncStatus?.totalOrdersSynced || 0;
    totalStampsIssued += conn.syncStatus?.totalStampsIssued || 0;
    totalUnmatchedOrders += conn.syncStatus?.unmatchedOrders || 0;
    
    platformStats[conn.platform] = {
      status: conn.status,
      ordersSynced: conn.syncStatus?.totalOrdersSynced || 0,
      stampsIssued: conn.syncStatus?.totalStampsIssued || 0,
      lastSync: conn.syncStatus?.lastSyncAt,
    };
  }
  
  res.json({
    success: true,
    data: {
      totalConnections: connectionIds.length,
      totalOrdersSynced,
      totalStampsIssued,
      totalUnmatchedOrders,
      matchRate: totalOrdersSynced > 0 
        ? Math.round((totalStampsIssued / totalOrdersSynced) * 100) 
        : 0,
      byPlatform: platformStats,
    },
  });
}));

// ============================================
// MANUAL ORDER ENTRY
// ============================================

/**
 * POST /api/v1/integrations/manual/order
 * Manually enter an online order (for Vinted, etc.)
 */
router.post('/manual/order', asyncHandler(async (req: Request, res: Response) => {
  const { 
    businessId, 
    platform, 
    customerEmail, 
    orderReference, 
    orderValue, 
    currency = 'GBP',
    orderDate 
  } = req.body;
  
  if (!businessId || !customerEmail || !orderValue) {
    return res.status(400).json({
      success: false,
      error: 'businessId, customerEmail, and orderValue are required',
    });
  }
  
  // Import order processor
  const { orderProcessor } = await import('../../services/order-processor.service');
  const { v4: uuidv4 } = await import('uuid');
  
  // Create manual order
  const order = {
    id: uuidv4(),
    businessId,
    connectionId: 'manual',
    platform: platform || 'custom',
    externalOrderId: orderReference || `MANUAL-${Date.now()}`,
    externalOrderNumber: orderReference,
    customerEmail: customerEmail.toLowerCase(),
    orderDate: orderDate || new Date().toISOString(),
    orderStatus: 'completed' as const,
    orderTotal: Math.round(parseFloat(orderValue) * 100),
    orderSubtotal: Math.round(parseFloat(orderValue) * 100),
    shippingCost: 0,
    currency,
    items: [],
    itemCount: 1,
    fulfillmentType: 'delivery' as const,
    processingStatus: 'pending' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  // Store and process
  await orderProcessor.storeOrder(order);
  const result = await orderProcessor.processOrder(order);
  
  res.json({
    success: true,
    data: result,
  });
}));

// ============================================
// MOUNT PLATFORM ROUTES
// ============================================

router.use('/shopify', shopifyRoutes);
router.use('/ebay', ebayRoutes);
router.use('/woocommerce', woocommerceRoutes);

// Future platforms:
// router.use('/etsy', etsyRoutes);

export default router;

