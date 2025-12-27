// WooCommerce Integration Routes
// Handles OAuth 1.0a connection and webhook processing

import { Router, Request, Response } from 'express';
import { asyncHandler, ApiError } from '../../middleware/errorHandler';
import { wooCommerceService } from '../../services/woocommerce.service';
import { redisClient } from '../../config/redis';
import { ECOMMERCE_REDIS_KEYS } from '../../types/ecommerce';
import { orderProcessor } from '../../services/order-processor.service';

const router = Router();

/**
 * POST /api/v1/integrations/woocommerce/connect
 * Connect a WooCommerce store
 * 
 * Body:
 * {
 *   businessId: string;
 *   storeUrl: string;      // e.g., "https://example.com"
 *   consumerKey: string;   // WooCommerce API Consumer Key
 *   consumerSecret: string; // WooCommerce API Consumer Secret
 * }
 */
router.post('/connect', asyncHandler(async (req: Request, res: Response) => {
  const { businessId, storeUrl, consumerKey, consumerSecret } = req.body;
  
  if (!businessId || !storeUrl || !consumerKey || !consumerSecret) {
    throw new ApiError(400, 'Missing required fields: businessId, storeUrl, consumerKey, consumerSecret');
  }
  
  // Validate store URL
  try {
    new URL(storeUrl);
  } catch {
    throw new ApiError(400, 'Invalid store URL');
  }
  
  // Create connection
  const connection = await wooCommerceService.createConnection(
    businessId,
    storeUrl,
    consumerKey,
    consumerSecret
  );
  
  res.json({
    success: true,
    data: {
      connectionId: connection.id,
      storeName: connection.platformShopName,
      status: connection.status,
    },
  });
}));

/**
 * GET /api/v1/integrations/woocommerce/connection/:connectionId
 * Get connection details
 */
router.get('/connection/:connectionId', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId } = req.params;
  
  const data = await redisClient.get(ECOMMERCE_REDIS_KEYS.connection(connectionId));
  if (!data) {
    throw new ApiError(404, 'Connection not found');
  }
  
  const connection = JSON.parse(data);
  
  // Don't expose credentials
  delete connection.accessToken;
  delete connection.refreshToken;
  delete connection.webhookSecret;
  
  res.json({
    success: true,
    data: connection,
  });
}));

/**
 * DELETE /api/v1/integrations/woocommerce/connection/:connectionId
 * Disconnect WooCommerce store
 */
router.delete('/connection/:connectionId', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId } = req.params;
  
  const data = await redisClient.get(ECOMMERCE_REDIS_KEYS.connection(connectionId));
  if (!data) {
    throw new ApiError(404, 'Connection not found');
  }
  
  const connection = JSON.parse(data);
  
  // Update status
  connection.status = 'disconnected';
  connection.updatedAt = new Date().toISOString();
  
  await redisClient.set(
    ECOMMERCE_REDIS_KEYS.connection(connectionId),
    JSON.stringify(connection)
  );
  
  res.json({
    success: true,
    message: 'WooCommerce connection disconnected',
  });
}));

/**
 * POST /api/v1/integrations/woocommerce/webhook
 * Handle WooCommerce webhook
 * 
 * WooCommerce webhooks can be configured to send order events
 * Webhook URL: https://your-api.com/api/v1/integrations/woocommerce/webhook
 */
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId } = req.query;
  
  if (!connectionId || typeof connectionId !== 'string') {
    throw new ApiError(400, 'Connection ID is required');
  }
  
  // Get connection
  const connectionData = await redisClient.get(ECOMMERCE_REDIS_KEYS.connection(connectionId));
  if (!connectionData) {
    throw new ApiError(404, 'Connection not found');
  }
  
  const connection = JSON.parse(connectionData);
  
  // Verify webhook signature (if configured)
  const signature = req.headers['x-wc-webhook-signature'] as string;
  if (signature && connection.webhookSecret) {
    const body = JSON.stringify(req.body);
    const isValid = wooCommerceService.verifyWebhookSignature(
      body,
      signature,
      connection.webhookSecret
    );
    
    if (!isValid) {
      throw new ApiError(401, 'Invalid webhook signature');
    }
  }
  const orderData = req.body;
  
  // Process webhook
  const order = await wooCommerceService.processWebhook(
    connectionId,
    req.headers['x-wc-webhook-event'] as string || 'order.updated',
    orderData
  );
  
  // Store and process order
  await orderProcessor.storeOrder(order);
  const result = await orderProcessor.processOrder(order);
  
  res.json({
    success: true,
    data: result,
  });
}));

/**
 * POST /api/v1/integrations/woocommerce/sync
 * Manually sync orders from WooCommerce
 */
router.post('/sync', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, after } = req.body;
  
  if (!connectionId) {
    throw new ApiError(400, 'Connection ID is required');
  }
  
  const connectionData = await redisClient.get(ECOMMERCE_REDIS_KEYS.connection(connectionId));
  if (!connectionData) {
    throw new ApiError(404, 'Connection not found');
  }
  
  const connection = JSON.parse(connectionData);
  
  // Get orders
  const orders = await wooCommerceService.getOrders(connection, after);
  
  // Process each order
  const results = [];
  for (const order of orders) {
    await orderProcessor.storeOrder(order);
    const result = await orderProcessor.processOrder(order);
    results.push(result);
  }
  
  // Update sync status
  connection.syncStatus.lastSyncAt = new Date().toISOString();
  connection.syncStatus.lastSyncStatus = 'success';
  connection.syncStatus.totalOrdersSynced += orders.length;
  connection.updatedAt = new Date().toISOString();
  
  await redisClient.set(
    ECOMMERCE_REDIS_KEYS.connection(connectionId),
    JSON.stringify(connection)
  );
  
  res.json({
    success: true,
    data: {
      ordersProcessed: orders.length,
      results,
    },
  });
}));

export default router;

