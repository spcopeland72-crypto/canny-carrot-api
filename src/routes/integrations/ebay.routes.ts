// eBay Integration Routes
// OAuth flow, notifications, and connection management

import { Router, Request, Response } from 'express';
import { ebayService } from '../../services/ebay.service';
import { orderProcessor } from '../../services/order-processor.service';
import { asyncHandler, ApiError } from '../../middleware/errorHandler';
import { redisClient } from '../../config/redis';
import { ECOMMERCE_REDIS_KEYS } from '../../types/ecommerce';

const router = Router();

// ============================================
// OAUTH FLOW
// ============================================

/**
 * GET /api/v1/integrations/ebay/connect
 * Start eBay OAuth flow
 * Query params: businessId
 */
router.get('/connect', asyncHandler(async (req: Request, res: Response) => {
  const { businessId } = req.query;
  
  if (!businessId) {
    throw new ApiError(400, 'businessId is required');
  }
  
  // Generate OAuth URL
  const authUrl = ebayService.getAuthorizationUrl(businessId as string);
  
  // Redirect to eBay
  res.redirect(authUrl);
}));

/**
 * GET /api/v1/integrations/ebay/callback
 * eBay OAuth callback (also called "accepted" endpoint)
 */
router.get('/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state } = req.query;
  
  if (!code || !state) {
    // Check for error response
    const error = req.query.error;
    const errorDescription = req.query.error_description;
    
    if (error) {
      console.error('eBay OAuth error:', error, errorDescription);
      const errorUrl = `${process.env.BUSINESS_APP_URL || 'http://localhost:8081'}/integrations?error=ebay&message=${encodeURIComponent(errorDescription as string || 'Authorization failed')}`;
      return res.redirect(errorUrl);
    }
    
    throw new ApiError(400, 'Missing required OAuth parameters');
  }
  
  try {
    // Get businessId from state
    const stateData = await redisClient.get(`ebay:oauth:state:${state}`);
    if (!stateData) {
      throw new ApiError(400, 'OAuth session expired');
    }
    
    const { businessId } = JSON.parse(stateData);
    
    // Exchange code for tokens
    const { accessToken, refreshToken, expiresIn } = await ebayService.exchangeCodeForToken(
      code as string,
      state as string
    );
    
    // Create connection
    const connection = await ebayService.createConnection(
      businessId,
      accessToken,
      refreshToken,
      expiresIn
    );
    
    console.log(`✅ eBay connected for business ${businessId}: ${connection.platformShopName}`);
    
    // Initial sync of recent orders
    try {
      const syncResult = await ebayService.syncOrders(connection.id);
      console.log(`📦 Initial eBay sync: ${syncResult.synced} orders synced`);
    } catch (syncError) {
      console.error('Initial eBay sync failed:', syncError);
    }
    
    // Redirect to success page
    const successUrl = `${process.env.BUSINESS_APP_URL || 'http://localhost:8081'}/integrations?success=ebay&connectionId=${connection.id}`;
    res.redirect(successUrl);
    
  } catch (error) {
    console.error('eBay OAuth error:', error);
    const errorUrl = `${process.env.BUSINESS_APP_URL || 'http://localhost:8081'}/integrations?error=ebay&message=${encodeURIComponent((error as Error).message)}`;
    res.redirect(errorUrl);
  }
}));

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * POST /api/v1/integrations/ebay/notification
 * Handle eBay notifications (account deletion, etc.)
 */
router.post('/notification', async (req: Request, res: Response) => {
  const signature = req.headers['x-ebay-signature'] as string;
  const timestamp = req.headers['x-ebay-timestamp'] as string;
  
  console.log('📥 eBay notification received');
  
  try {
    // Parse notification
    const notification = ebayService.parseNotification(req.body);
    
    if (!notification) {
      console.warn('Invalid eBay notification format');
      return res.status(200).send('OK');
    }
    
    console.log(`eBay notification type: ${notification.notificationType}`);
    
    // Handle different notification types
    switch (notification.notificationType) {
      case 'MARKETPLACE_ACCOUNT_DELETION':
        // Handle GDPR account deletion request
        await handleAccountDeletion(notification.data);
        break;
        
      default:
        console.log('Unhandled eBay notification:', notification.notificationType);
    }
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('eBay notification error:', error);
    res.status(200).send('Error logged');
  }
});

/**
 * Handle eBay account deletion (GDPR requirement)
 */
async function handleAccountDeletion(data: any): Promise<void> {
  const userId = data.userId;
  if (!userId) return;
  
  console.log(`Processing eBay account deletion for user: ${userId}`);
  
  // Find connection by user ID
  const connection = await ebayService.getConnectionByUserId(userId);
  if (connection) {
    // Disconnect the account
    await ebayService.disconnect(connection.id);
    console.log(`✅ eBay account ${userId} disconnected due to deletion request`);
  }
}

// ============================================
// ORDER SYNC (POLLING)
// ============================================

/**
 * POST /api/v1/integrations/ebay/sync
 * Trigger manual order sync for a connection
 */
router.post('/sync', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId } = req.body;
  
  if (!connectionId) {
    throw new ApiError(400, 'connectionId is required');
  }
  
  const connection = await ebayService.getConnection(connectionId);
  if (!connection) {
    throw new ApiError(404, 'Connection not found');
  }
  
  if (connection.platform !== 'ebay') {
    throw new ApiError(400, 'Not an eBay connection');
  }
  
  // Perform sync
  const result = await ebayService.syncOrders(connectionId);
  
  res.json({
    success: true,
    data: {
      orderssynced: result.synced,
      errors: result.errors,
      message: `Synced ${result.synced} orders from eBay`,
    },
  });
}));

/**
 * GET /api/v1/integrations/ebay/sync/status
 * Get sync status for a connection
 */
router.get('/sync/status', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId } = req.query;
  
  if (!connectionId) {
    throw new ApiError(400, 'connectionId is required');
  }
  
  const connection = await ebayService.getConnection(connectionId as string);
  if (!connection) {
    throw new ApiError(404, 'Connection not found');
  }
  
  res.json({
    success: true,
    data: {
      lastSyncAt: connection.syncStatus.lastSyncAt,
      lastSyncStatus: connection.syncStatus.lastSyncStatus,
      totalOrdersSynced: connection.syncStatus.totalOrdersSynced,
      totalStampsIssued: connection.syncStatus.totalStampsIssued,
      unmatchedOrders: connection.syncStatus.unmatchedOrders,
      lastError: connection.syncStatus.lastError,
    },
  });
}));

// ============================================
// CONNECTION MANAGEMENT
// ============================================

/**
 * GET /api/v1/integrations/ebay/connections
 * Get eBay connections for a business
 */
router.get('/connections', asyncHandler(async (req: Request, res: Response) => {
  const { businessId } = req.query;
  
  if (!businessId) {
    throw new ApiError(400, 'businessId is required');
  }
  
  const connections = await ebayService.getBusinessConnections(businessId as string);
  
  // Don't return sensitive data
  const safeConnections = connections.map(c => ({
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
 * GET /api/v1/integrations/ebay/connection/:connectionId
 * Get single eBay connection details
 */
router.get('/connection/:connectionId', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId } = req.params;
  
  const connection = await ebayService.getConnection(connectionId);
  
  if (!connection) {
    throw new ApiError(404, 'Connection not found');
  }
  
  if (connection.platform !== 'ebay') {
    throw new ApiError(400, 'Not an eBay connection');
  }
  
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
 * PUT /api/v1/integrations/ebay/connection/:connectionId/settings
 * Update connection settings
 */
router.put('/connection/:connectionId/settings', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId } = req.params;
  const settings = req.body;
  
  const connection = await ebayService.getConnection(connectionId);
  
  if (!connection) {
    throw new ApiError(404, 'Connection not found');
  }
  
  if (connection.platform !== 'ebay') {
    throw new ApiError(400, 'Not an eBay connection');
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
 * DELETE /api/v1/integrations/ebay/connection/:connectionId
 * Disconnect eBay account
 */
router.delete('/connection/:connectionId', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId } = req.params;
  
  const connection = await ebayService.getConnection(connectionId);
  
  if (!connection) {
    throw new ApiError(404, 'Connection not found');
  }
  
  if (connection.platform !== 'ebay') {
    throw new ApiError(400, 'Not an eBay connection');
  }
  
  await ebayService.disconnect(connectionId);
  
  res.json({
    success: true,
    message: 'eBay account disconnected',
  });
}));

// ============================================
// ORDERS
// ============================================

/**
 * GET /api/v1/integrations/ebay/orders
 * Get eBay orders for a connection
 */
router.get('/orders', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, status, limit = 50 } = req.query;
  
  if (!connectionId) {
    throw new ApiError(400, 'connectionId is required');
  }
  
  const connection = await ebayService.getConnection(connectionId as string);
  
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
  let filteredOrders = orders.filter(o => o && o.platform === 'ebay');
  
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
 * GET /api/v1/integrations/ebay/orders/unmatched
 * Get unmatched eBay orders (no member found)
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
    data: orders.filter(o => o && o.platform === 'ebay'),
  });
}));

/**
 * POST /api/v1/integrations/ebay/orders/:orderId/retry
 * Retry processing a failed order
 */
router.post('/orders/:orderId/retry', asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  
  const orderData = await redisClient.get(ECOMMERCE_REDIS_KEYS.order(orderId));
  if (!orderData) {
    throw new ApiError(404, 'Order not found');
  }
  
  const order = JSON.parse(orderData);
  
  if (order.platform !== 'ebay') {
    throw new ApiError(400, 'Not an eBay order');
  }
  
  // Reset processing status
  order.processingStatus = 'pending';
  order.processingError = undefined;
  order.updatedAt = new Date().toISOString();
  
  await redisClient.set(ECOMMERCE_REDIS_KEYS.order(orderId), JSON.stringify(order));
  
  // Process again
  const result = await orderProcessor.processOrder(order);
  
  res.json({
    success: true,
    data: result,
  });
}));

export default router;




















