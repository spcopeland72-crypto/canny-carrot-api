// Shopify Integration Routes
// OAuth flow, webhooks, and connection management

import { Router, Request, Response } from 'express';
import { shopifyService } from '../../services/shopify.service';
import { orderProcessor } from '../../services/order-processor.service';
import { asyncHandler, ApiError } from '../../middleware/errorHandler';
import { redisClient } from '../../config/redis';
import { ECOMMERCE_REDIS_KEYS } from '../../types/ecommerce';

const router = Router();

// ============================================
// OAUTH FLOW
// ============================================

/**
 * GET /api/v1/integrations/shopify/connect
 * Start Shopify OAuth flow
 * Query params: businessId, shop (e.g., mystore.myshopify.com)
 */
router.get('/connect', asyncHandler(async (req: Request, res: Response) => {
  const { businessId, shop } = req.query;
  
  if (!businessId || !shop) {
    throw new ApiError(400, 'businessId and shop are required');
  }
  
  // Validate shop domain format
  const shopDomain = (shop as string).replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!shopDomain.includes('.myshopify.com')) {
    throw new ApiError(400, 'Invalid Shopify shop domain. Use format: yourstore.myshopify.com');
  }
  
  // Generate OAuth URL
  const authUrl = shopifyService.getAuthorizationUrl(shopDomain, businessId as string);
  
  // Redirect to Shopify
  res.redirect(authUrl);
}));

/**
 * GET /api/v1/integrations/shopify/callback
 * Shopify OAuth callback
 */
router.get('/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, shop, state, hmac } = req.query;
  
  if (!code || !shop || !state) {
    throw new ApiError(400, 'Missing required OAuth parameters');
  }
  
  try {
    // Exchange code for token
    const { accessToken } = await shopifyService.exchangeCodeForToken(
      shop as string,
      code as string,
      state as string
    );
    
    // Get businessId from state (stored during connect)
    const stateData = await redisClient.get(`shopify:oauth:state:${state}`);
    let businessId: string;
    
    if (stateData) {
      const parsed = JSON.parse(stateData);
      businessId = parsed.businessId;
    } else {
      // Fallback - try to get from nonce
      const nonceData = await redisClient.get(`shopify:oauth:nonce:${state}`);
      if (nonceData) {
        businessId = JSON.parse(nonceData).businessId;
      } else {
        throw new ApiError(400, 'OAuth session expired');
      }
    }
    
    // Create connection
    const connection = await shopifyService.createConnection(
      businessId,
      shop as string,
      accessToken
    );
    
    console.log(`✅ Shopify connected for business ${businessId}: ${shop}`);
    
    // Redirect to success page in business console
    const successUrl = `${process.env.BUSINESS_APP_URL || 'http://localhost:8081'}/integrations?success=shopify&connectionId=${connection.id}`;
    res.redirect(successUrl);
    
  } catch (error) {
    console.error('Shopify OAuth error:', error);
    
    // Redirect to error page
    const errorUrl = `${process.env.BUSINESS_APP_URL || 'http://localhost:8081'}/integrations?error=shopify&message=${encodeURIComponent((error as Error).message)}`;
    res.redirect(errorUrl);
  }
}));

// ============================================
// WEBHOOKS
// ============================================

/**
 * POST /api/v1/integrations/shopify/webhook
 * Handle Shopify webhooks (orders, app events)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  // Get headers
  const hmac = req.headers['x-shopify-hmac-sha256'] as string;
  const topic = req.headers['x-shopify-topic'] as string;
  const shopDomain = req.headers['x-shopify-shop-domain'] as string;
  
  if (!hmac || !topic || !shopDomain) {
    console.warn('Shopify webhook missing headers');
    return res.status(400).send('Missing headers');
  }
  
  try {
    // Get connection by shop domain
    const connection = await shopifyService.getConnectionByShop(shopDomain);
    
    if (!connection) {
      console.warn(`No connection found for shop: ${shopDomain}`);
      return res.status(200).send('OK'); // Acknowledge but ignore
    }
    
    // Verify HMAC signature
    const webhookSecret = await redisClient.get(
      ECOMMERCE_REDIS_KEYS.webhookSecret(connection.id)
    );
    
    // Note: In production, use raw body for HMAC verification
    // For now, we'll skip HMAC for development
    // if (!shopifyService.verifyWebhookSignature(rawBody, hmac, webhookSecret || '')) {
    //   console.warn('Shopify webhook HMAC verification failed');
    //   return res.status(401).send('Invalid signature');
    // }
    
    console.log(`📥 Shopify webhook received: ${topic} from ${shopDomain}`);
    
    // Handle different webhook topics
    switch (topic) {
      case 'orders/create':
      case 'orders/updated':
      case 'orders/paid':
        await handleOrderWebhook(req.body, connection.id, connection.businessId, topic);
        break;
        
      case 'app/uninstalled':
        await handleAppUninstalled(connection.id, shopDomain);
        break;
        
      default:
        console.log(`Unhandled Shopify webhook topic: ${topic}`);
    }
    
    // Always respond 200 to acknowledge receipt
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('Shopify webhook error:', error);
    // Still return 200 to prevent Shopify retries
    res.status(200).send('Error logged');
  }
});

/**
 * Handle order webhooks
 */
async function handleOrderWebhook(
  payload: any,
  connectionId: string,
  businessId: string,
  topic: string
): Promise<void> {
  console.log(`📦 Processing Shopify order webhook: ${topic}, Order ID: ${payload.id}`);
  
  // Parse order
  const order = shopifyService.parseOrderWebhook(payload, connectionId, businessId);
  
  // Store order
  await orderProcessor.storeOrder(order);
  
  // Process order (match member, issue stamp)
  const result = await orderProcessor.processOrder(order);
  
  console.log(`📦 Order processing result:`, result);
}

/**
 * Handle app uninstall
 */
async function handleAppUninstalled(connectionId: string, shop: string): Promise<void> {
  console.log(`⚠️ Shopify app uninstalled from ${shop}`);
  
  await shopifyService.disconnect(connectionId);
}

// ============================================
// CONNECTION MANAGEMENT
// ============================================

/**
 * GET /api/v1/integrations/shopify/connections
 * Get Shopify connections for a business
 */
router.get('/connections', asyncHandler(async (req: Request, res: Response) => {
  const { businessId } = req.query;
  
  if (!businessId) {
    throw new ApiError(400, 'businessId is required');
  }
  
  const connections = await shopifyService.getBusinessConnections(businessId as string);
  const shopifyConnections = connections.filter(c => c.platform === 'shopify');
  
  // Don't return sensitive data
  const safeConnections = shopifyConnections.map(c => ({
    id: c.id,
    platform: c.platform,
    status: c.status,
    platformShopId: c.platformShopId,
    platformShopName: c.platformShopName,
    storeUrl: c.storeUrl,
    settings: c.settings,
    syncStatus: c.syncStatus,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
  
  res.json({
    success: true,
    data: safeConnections,
  });
}));

/**
 * GET /api/v1/integrations/shopify/connection/:connectionId
 * Get single Shopify connection details
 */
router.get('/connection/:connectionId', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId } = req.params;
  
  const connection = await shopifyService.getConnection(connectionId);
  
  if (!connection) {
    throw new ApiError(404, 'Connection not found');
  }
  
  // Don't return tokens
  const safeConnection = {
    id: connection.id,
    businessId: connection.businessId,
    platform: connection.platform,
    status: connection.status,
    platformShopId: connection.platformShopId,
    platformShopName: connection.platformShopName,
    storeUrl: connection.storeUrl,
    settings: connection.settings,
    syncStatus: connection.syncStatus,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
  
  res.json({
    success: true,
    data: safeConnection,
  });
}));

/**
 * PUT /api/v1/integrations/shopify/connection/:connectionId/settings
 * Update connection settings
 */
router.put('/connection/:connectionId/settings', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId } = req.params;
  const settings = req.body;
  
  const connection = await shopifyService.getConnection(connectionId);
  
  if (!connection) {
    throw new ApiError(404, 'Connection not found');
  }
  
  // Update settings
  connection.settings = {
    ...connection.settings,
    ...settings,
  };
  connection.updatedAt = new Date().toISOString();
  
  await redisClient.set(
    ECOMMERCE_REDIS_KEYS.connection(connectionId),
    JSON.stringify(connection)
  );
  
  res.json({
    success: true,
    data: connection.settings,
    message: 'Settings updated',
  });
}));

/**
 * DELETE /api/v1/integrations/shopify/connection/:connectionId
 * Disconnect Shopify store
 */
router.delete('/connection/:connectionId', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId } = req.params;
  
  const connection = await shopifyService.getConnection(connectionId);
  
  if (!connection) {
    throw new ApiError(404, 'Connection not found');
  }
  
  await shopifyService.disconnect(connectionId);
  
  res.json({
    success: true,
    message: 'Shopify store disconnected',
  });
}));

// ============================================
// ORDERS
// ============================================

/**
 * GET /api/v1/integrations/shopify/orders
 * Get orders for a connection
 */
router.get('/orders', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, status, limit = 50 } = req.query;
  
  if (!connectionId) {
    throw new ApiError(400, 'connectionId is required');
  }
  
  const connection = await shopifyService.getConnection(connectionId as string);
  
  if (!connection) {
    throw new ApiError(404, 'Connection not found');
  }
  
  // Get order IDs
  const orderIds = await redisClient.lrange(
    ECOMMERCE_REDIS_KEYS.businessOrders(connection.businessId),
    0,
    parseInt(limit as string) - 1
  );
  
  // Get orders
  const orders = await Promise.all(
    orderIds.map(async (id) => {
      const data = await redisClient.get(ECOMMERCE_REDIS_KEYS.order(id));
      return data ? JSON.parse(data) : null;
    })
  );
  
  // Filter by platform and optionally status
  let filteredOrders = orders.filter(o => o && o.platform === 'shopify');
  
  if (status) {
    filteredOrders = filteredOrders.filter(o => o.processingStatus === status);
  }
  
  res.json({
    success: true,
    data: filteredOrders,
    meta: {
      total: filteredOrders.length,
      limit: parseInt(limit as string),
    },
  });
}));

/**
 * GET /api/v1/integrations/shopify/orders/unmatched
 * Get unmatched orders (no member found)
 */
router.get('/orders/unmatched', asyncHandler(async (req: Request, res: Response) => {
  const { businessId, limit = 50 } = req.query;
  
  if (!businessId) {
    throw new ApiError(400, 'businessId is required');
  }
  
  const orderIds = await redisClient.lrange(
    ECOMMERCE_REDIS_KEYS.unmatchedOrders(businessId as string),
    0,
    parseInt(limit as string) - 1
  );
  
  const orders = await Promise.all(
    orderIds.map(async (id) => {
      const data = await redisClient.get(ECOMMERCE_REDIS_KEYS.order(id));
      return data ? JSON.parse(data) : null;
    })
  );
  
  res.json({
    success: true,
    data: orders.filter(o => o && o.platform === 'shopify'),
  });
}));

export default router;


















