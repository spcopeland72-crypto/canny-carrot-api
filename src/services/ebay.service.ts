// eBay Integration Service
// Handles OAuth, API calls, and notification verification
// eBay UK Marketplace: EBAY_GB

import crypto from 'crypto';
import { config } from '../config/env';
import { 
  EcommerceConnection, 
  EcommerceOrder,
  EcommerceConnectionStatus,
  EbayOrder,
  EbayOrderNotification,
} from '../types/ecommerce';
import { redisClient } from '../config/redis';
import { ECOMMERCE_REDIS_KEYS } from '../types/ecommerce';
import { v4 as uuidv4 } from 'uuid';

// eBay API endpoints
const EBAY_AUTH_URL = 'https://auth.ebay.com/oauth2/authorize';
const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_API_URL = 'https://api.ebay.com';

// eBay UK Site ID
const EBAY_UK_SITE_ID = 'EBAY_GB';

// OAuth scopes for eBay
const EBAY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/commerce.notification.subscription',
].join(' ');

export class EbayService {
  
  // ============================================
  // OAUTH FLOW
  // ============================================
  
  /**
   * Generate the eBay OAuth authorization URL
   */
  getAuthorizationUrl(businessId: string): string {
    const state = crypto.randomBytes(16).toString('hex');
    
    // Store state for verification
    redisClient.setex(
      `ebay:oauth:state:${state}`,
      600, // 10 minute expiry
      JSON.stringify({ businessId })
    );
    
    const params = new URLSearchParams({
      client_id: config.ebay.clientId,
      response_type: 'code',
      redirect_uri: config.ebay.ruName, // eBay uses RuName instead of redirect_uri
      scope: EBAY_SCOPES,
      state,
    });
    
    return `${EBAY_AUTH_URL}?${params.toString()}`;
  }
  
  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, state: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    // Verify state
    const stateData = await redisClient.get(`ebay:oauth:state:${state}`);
    if (!stateData) {
      throw new Error('Invalid or expired OAuth state');
    }
    
    // Create Basic auth header
    const credentials = Buffer.from(
      `${config.ebay.clientId}:${config.ebay.clientSecret}`
    ).toString('base64');
    
    const response = await fetch(EBAY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.ebay.ruName,
      }).toString(),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`eBay token exchange failed: ${error}`);
    }
    
    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    
    // Clean up state
    await redisClient.del(`ebay:oauth:state:${state}`);
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }
  
  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    const credentials = Buffer.from(
      `${config.ebay.clientId}:${config.ebay.clientSecret}`
    ).toString('base64');
    
    const response = await fetch(EBAY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: EBAY_SCOPES,
      }).toString(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh eBay token');
    }
    
    const data = await response.json() as {
      access_token: string;
      expires_in: number;
    };
    
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }
  
  /**
   * Create and store a new eBay connection
   */
  async createConnection(
    businessId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): Promise<EcommerceConnection> {
    const connectionId = uuidv4();
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    
    // Get user info
    const userInfo = await this.getUserInfo(accessToken);
    
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    const connection: EcommerceConnection = {
      id: connectionId,
      businessId,
      platform: 'ebay',
      status: 'connected',
      accessToken: this.encryptToken(accessToken),
      refreshToken: this.encryptToken(refreshToken),
      tokenExpiresAt,
      platformShopId: userInfo.userId,
      platformShopName: userInfo.username,
      storeUrl: `https://www.ebay.co.uk/usr/${userInfo.username}`,
      webhookSecret,
      settings: {
        autoStampEnabled: true,
        orderStatusTrigger: 'payment_complete',
        minimumOrderValue: 0,
        qualifyingProducts: 'all',
        notifyCustomer: true,
      },
      syncStatus: {
        lastSyncStatus: 'never',
        totalOrdersSynced: 0,
        totalStampsIssued: 0,
        unmatchedOrders: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Store connection
    await redisClient.set(
      ECOMMERCE_REDIS_KEYS.connection(connectionId),
      JSON.stringify(connection)
    );
    
    // Add to business's connections
    await redisClient.sadd(
      ECOMMERCE_REDIS_KEYS.businessConnections(businessId),
      connectionId
    );
    
    // Create lookup by eBay user ID
    await redisClient.set(
      ECOMMERCE_REDIS_KEYS.connectionByShop('ebay', userInfo.userId),
      connectionId
    );
    
    // Store webhook secret
    await redisClient.set(
      ECOMMERCE_REDIS_KEYS.webhookSecret(connectionId),
      webhookSecret
    );
    
    // Subscribe to order notifications
    await this.subscribeToNotifications(accessToken, connectionId);
    
    return connection;
  }
  
  // ============================================
  // EBAY API CALLS
  // ============================================
  
  /**
   * Get eBay user info
   */
  async getUserInfo(accessToken: string): Promise<{ userId: string; username: string }> {
    const response = await fetch(
      `${EBAY_API_URL}/commerce/identity/v1/user/`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to get eBay user info');
    }
    
    const data = await response.json() as {
      userId: string;
      username: string;
    };
    return {
      userId: data.userId,
      username: data.username,
    };
  }
  
  /**
   * Subscribe to eBay order notifications
   */
  async subscribeToNotifications(accessToken: string, connectionId: string): Promise<void> {
    const notificationEndpoint = `${config.apiBaseUrl}/api/v1/integrations/ebay/notification`;
    
    // eBay notification topics for orders
    const topics = [
      'MARKETPLACE_ACCOUNT_DELETION', // Required by eBay
      // Note: eBay uses different notification mechanisms
      // For orders, we'll need to poll or use the Fulfillment API
    ];
    
    for (const topic of topics) {
      try {
        const response = await fetch(
          `${EBAY_API_URL}/commerce/notification/v1/subscription`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              topicId: topic,
              payload: {
                destinationId: connectionId,
              },
              deliveryConfig: {
                destinationId: connectionId,
                endpoint: notificationEndpoint,
              },
            }),
          }
        );
        
        if (response.ok) {
          console.log(`✅ Subscribed to eBay notification: ${topic}`);
        }
      } catch (error) {
        console.error(`Failed to subscribe to ${topic}:`, error);
      }
    }
  }
  
  /**
   * Get orders from eBay (polling method)
   */
  async getOrders(
    accessToken: string, 
    options: { 
      daysBack?: number; 
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<EbayOrder[]> {
    const { daysBack = 7, limit = 50, offset = 0 } = options;
    
    // Calculate date range
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    
    const params = new URLSearchParams({
      filter: `creationdate:[${startDate}..${endDate}]`,
      limit: limit.toString(),
      offset: offset.toString(),
    });
    
    const response = await fetch(
      `${EBAY_API_URL}/sell/fulfillment/v1/order?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': EBAY_UK_SITE_ID,
        },
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get eBay orders: ${error}`);
    }
    
    const data = await response.json() as {
      orders?: EbayOrder[];
    };
    return data.orders || [];
  }
  
  /**
   * Get single order by ID
   */
  async getOrder(accessToken: string, orderId: string): Promise<EbayOrder | null> {
    const response = await fetch(
      `${EBAY_API_URL}/sell/fulfillment/v1/order/${orderId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': EBAY_UK_SITE_ID,
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to get eBay order');
    }
    
    return (await response.json()) as EbayOrder;
  }
  
  // ============================================
  // ORDER PARSING
  // ============================================
  
  /**
   * Parse eBay order to our format
   */
  parseOrder(
    ebayOrder: EbayOrder,
    connectionId: string,
    businessId: string
  ): EcommerceOrder {
    const buyer = ebayOrder.buyer || {};
    
    return {
      id: uuidv4(),
      businessId,
      connectionId,
      platform: 'ebay',
      externalOrderId: ebayOrder.orderId,
      externalOrderNumber: ebayOrder.orderId,
      customerEmail: buyer.buyerRegistrationAddress?.email?.toLowerCase() || '',
      customerName: buyer.buyerRegistrationAddress?.fullName,
      customerPhone: buyer.buyerRegistrationAddress?.primaryPhone?.phoneNumber,
      orderDate: ebayOrder.creationDate,
      orderStatus: this.mapEbayStatus(ebayOrder.orderFulfillmentStatus),
      orderTotal: Math.round(parseFloat(ebayOrder.pricingSummary?.total?.value || '0') * 100),
      orderSubtotal: Math.round(parseFloat(ebayOrder.pricingSummary?.priceSubtotal?.value || '0') * 100),
      shippingCost: Math.round(parseFloat(ebayOrder.pricingSummary?.deliveryCost?.value || '0') * 100),
      currency: ebayOrder.pricingSummary?.total?.currency || 'GBP',
      items: (ebayOrder.lineItems || []).map(item => ({
        externalId: item.lineItemId,
        sku: item.sku,
        name: item.title,
        quantity: item.quantity,
        unitPrice: Math.round(parseFloat(item.lineItemCost?.value || '0') * 100),
        totalPrice: Math.round(parseFloat(item.total?.value || '0') * 100),
      })),
      itemCount: ebayOrder.lineItems?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      fulfillmentType: 'delivery',
      shippingAddress: ebayOrder.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo ? {
        name: ebayOrder.fulfillmentStartInstructions[0].shippingStep.shipTo.fullName,
        line1: ebayOrder.fulfillmentStartInstructions[0].shippingStep.shipTo.contactAddress?.addressLine1 || '',
        line2: ebayOrder.fulfillmentStartInstructions[0].shippingStep.shipTo.contactAddress?.addressLine2,
        city: ebayOrder.fulfillmentStartInstructions[0].shippingStep.shipTo.contactAddress?.city || '',
        county: ebayOrder.fulfillmentStartInstructions[0].shippingStep.shipTo.contactAddress?.stateOrProvince,
        postcode: ebayOrder.fulfillmentStartInstructions[0].shippingStep.shipTo.contactAddress?.postalCode || '',
        country: ebayOrder.fulfillmentStartInstructions[0].shippingStep.shipTo.contactAddress?.countryCode || 'GB',
      } : undefined,
      processingStatus: 'pending',
      rawPayload: ebayOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Map eBay order status to our status
   */
  private mapEbayStatus(fulfillmentStatus: string): EcommerceOrder['orderStatus'] {
    switch (fulfillmentStatus) {
      case 'NOT_STARTED':
        return 'paid';
      case 'IN_PROGRESS':
        return 'processing';
      case 'FULFILLED':
        return 'delivered';
      default:
        return 'pending';
    }
  }
  
  // ============================================
  // NOTIFICATION HANDLING
  // ============================================
  
  /**
   * Verify eBay notification signature
   */
  verifyNotificationSignature(
    body: string,
    signature: string,
    timestamp: string
  ): boolean {
    // eBay uses a different verification method
    // For now, we'll do basic validation
    // In production, implement full eBay signature verification
    return signature && timestamp ? true : false;
  }
  
  /**
   * Parse eBay notification
   */
  parseNotification(payload: any): EbayOrderNotification | null {
    try {
      return {
        notificationType: payload.metadata?.topic,
        publishTime: payload.metadata?.publishTime,
        data: payload.notification,
      };
    } catch {
      return null;
    }
  }
  
  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================
  
  /**
   * Get connection by ID
   */
  async getConnection(connectionId: string): Promise<EcommerceConnection | null> {
    const data = await redisClient.get(ECOMMERCE_REDIS_KEYS.connection(connectionId));
    return data ? JSON.parse(data) : null;
  }
  
  /**
   * Get connection by eBay user ID
   */
  async getConnectionByUserId(userId: string): Promise<EcommerceConnection | null> {
    const connectionId = await redisClient.get(
      ECOMMERCE_REDIS_KEYS.connectionByShop('ebay', userId)
    );
    if (!connectionId) return null;
    return this.getConnection(connectionId);
  }
  
  /**
   * Get all eBay connections for a business
   */
  async getBusinessConnections(businessId: string): Promise<EcommerceConnection[]> {
    const connectionIds = await redisClient.smembers(
      ECOMMERCE_REDIS_KEYS.businessConnections(businessId)
    );
    
    const connections = await Promise.all(
      connectionIds.map(id => this.getConnection(id))
    );
    
    return connections.filter(
      (c): c is EcommerceConnection => c !== null && c.platform === 'ebay'
    );
  }
  
  /**
   * Get decrypted access token, refreshing if needed
   */
  async getValidAccessToken(connection: EcommerceConnection): Promise<string> {
    const now = new Date();
    const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : now;
    
    // If token expires in less than 5 minutes, refresh it
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      if (!connection.refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const refreshToken = this.decryptToken(connection.refreshToken);
      const { accessToken, expiresIn } = await this.refreshAccessToken(refreshToken);
      
      // Update connection with new token
      connection.accessToken = this.encryptToken(accessToken);
      connection.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      connection.updatedAt = new Date().toISOString();
      
      await redisClient.set(
        ECOMMERCE_REDIS_KEYS.connection(connection.id),
        JSON.stringify(connection)
      );
      
      return accessToken;
    }
    
    return this.decryptToken(connection.accessToken!);
  }
  
  /**
   * Update connection status
   */
  async updateConnectionStatus(
    connectionId: string,
    status: EcommerceConnectionStatus,
    error?: string
  ): Promise<void> {
    const connection = await this.getConnection(connectionId);
    if (!connection) return;
    
    connection.status = status;
    connection.updatedAt = new Date().toISOString();
    if (error) {
      connection.syncStatus.lastError = error;
    }
    
    await redisClient.set(
      ECOMMERCE_REDIS_KEYS.connection(connectionId),
      JSON.stringify(connection)
    );
  }
  
  /**
   * Disconnect eBay account
   */
  async disconnect(connectionId: string): Promise<void> {
    const connection = await this.getConnection(connectionId);
    if (!connection) return;
    
    // Remove from business connections
    await redisClient.srem(
      ECOMMERCE_REDIS_KEYS.businessConnections(connection.businessId),
      connectionId
    );
    
    // Remove user ID lookup
    if (connection.platformShopId) {
      await redisClient.del(
        ECOMMERCE_REDIS_KEYS.connectionByShop('ebay', connection.platformShopId)
      );
    }
    
    // Update status
    await this.updateConnectionStatus(connectionId, 'disconnected');
  }
  
  /**
   * Sync orders from eBay (polling)
   */
  async syncOrders(connectionId: string): Promise<{ synced: number; errors: number }> {
    const connection = await this.getConnection(connectionId);
    if (!connection) throw new Error('Connection not found');
    
    const accessToken = await this.getValidAccessToken(connection);
    const orders = await this.getOrders(accessToken, { daysBack: 7 });
    
    let synced = 0;
    let errors = 0;
    
    const { orderProcessor } = await import('./order-processor.service');
    
    for (const ebayOrder of orders) {
      try {
        // Check if already processed
        const existingOrderId = await redisClient.get(
          ECOMMERCE_REDIS_KEYS.orderByExternal('ebay', ebayOrder.orderId)
        );
        
        if (existingOrderId) continue; // Skip if already processed
        
        const order = this.parseOrder(ebayOrder, connectionId, connection.businessId);
        await orderProcessor.storeOrder(order);
        await orderProcessor.processOrder(order);
        synced++;
      } catch (error) {
        console.error(`Error processing eBay order ${ebayOrder.orderId}:`, error);
        errors++;
      }
    }
    
    // Update sync status
    connection.syncStatus.lastSyncAt = new Date().toISOString();
    connection.syncStatus.lastSyncStatus = errors > 0 ? 'partial' : 'success';
    connection.syncStatus.totalOrdersSynced += synced;
    connection.updatedAt = new Date().toISOString();
    
    await redisClient.set(
      ECOMMERCE_REDIS_KEYS.connection(connectionId),
      JSON.stringify(connection)
    );
    
    return { synced, errors };
  }
  
  // ============================================
  // TOKEN ENCRYPTION
  // ============================================
  
  private encryptToken(token: string): string {
    // In production, use proper encryption (AES-256-GCM)
    return Buffer.from(token).toString('base64');
  }
  
  private decryptToken(encryptedToken: string): string {
    return Buffer.from(encryptedToken, 'base64').toString('utf8');
  }
}

export const ebayService = new EbayService();

