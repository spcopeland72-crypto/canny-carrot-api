// Shopify Integration Service
// Handles OAuth, API calls, and webhook verification

import crypto from 'crypto';
import { config } from '../config/env';
import { 
  EcommerceConnection, 
  EcommerceOrder,
  ShopifyOrderWebhook,
  EcommerceConnectionStatus 
} from '../types/ecommerce';
import { redisClient } from '../config/redis';
import { ECOMMERCE_REDIS_KEYS } from '../types/ecommerce';
import { v4 as uuidv4 } from 'uuid';

// Shopify OAuth scopes we need
const SHOPIFY_SCOPES = [
  'read_orders',
  'read_customers',
].join(',');

// Shopify API version
const SHOPIFY_API_VERSION = '2024-01';

export class ShopifyService {
  
  // ============================================
  // OAUTH FLOW
  // ============================================
  
  /**
   * Generate the OAuth authorization URL
   */
  getAuthorizationUrl(shop: string, businessId: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Store nonce for verification
    redisClient.setex(
      `shopify:oauth:nonce:${nonce}`,
      600, // 10 minute expiry
      JSON.stringify({ shop, businessId })
    );
    
    const params = new URLSearchParams({
      client_id: config.shopify.clientId,
      scope: SHOPIFY_SCOPES,
      redirect_uri: config.shopify.redirectUri,
      state: nonce,
    });
    
    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }
  
  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    shop: string, 
    code: string, 
    state: string
  ): Promise<{ accessToken: string; scope: string }> {
    // Verify nonce
    const nonceData = await redisClient.get(`shopify:oauth:nonce:${state}`);
    if (!nonceData) {
      throw new Error('Invalid or expired OAuth state');
    }
    
    const { shop: expectedShop } = JSON.parse(nonceData);
    if (shop !== expectedShop) {
      throw new Error('Shop mismatch in OAuth callback');
    }
    
    // Exchange code for token
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.shopify.clientId,
        client_secret: config.shopify.clientSecret,
        code,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }
    
    const data = await response.json() as {
      access_token: string;
      scope: string;
    };
    
    // Clean up nonce
    await redisClient.del(`shopify:oauth:nonce:${state}`);
    
    return {
      accessToken: data.access_token,
      scope: data.scope,
    };
  }
  
  /**
   * Create and store a new Shopify connection
   */
  async createConnection(
    businessId: string,
    shop: string,
    accessToken: string
  ): Promise<EcommerceConnection> {
    const connectionId = uuidv4();
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    
    // Get shop info
    const shopInfo = await this.getShopInfo(shop, accessToken);
    
    const connection: EcommerceConnection = {
      id: connectionId,
      businessId,
      platform: 'shopify',
      status: 'connected',
      accessToken: this.encryptToken(accessToken),
      platformShopId: shop,
      platformShopName: shopInfo.name,
      storeUrl: `https://${shop}`,
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
    
    // Create lookup by shop domain
    await redisClient.set(
      ECOMMERCE_REDIS_KEYS.connectionByShop('shopify', shop),
      connectionId
    );
    
    // Store webhook secret separately
    await redisClient.set(
      ECOMMERCE_REDIS_KEYS.webhookSecret(connectionId),
      webhookSecret
    );
    
    // Register webhooks with Shopify
    await this.registerWebhooks(shop, accessToken, connectionId);
    
    return connection;
  }
  
  // ============================================
  // SHOPIFY API CALLS
  // ============================================
  
  /**
   * Get shop information
   */
  async getShopInfo(shop: string, accessToken: string): Promise<{ name: string; email: string }> {
    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch shop info');
    }
    
    const data = await response.json() as {
      shop: {
        name: string;
        email: string;
      };
    };
    return {
      name: data.shop.name,
      email: data.shop.email,
    };
  }
  
  /**
   * Register webhooks with Shopify
   */
  async registerWebhooks(
    shop: string, 
    accessToken: string,
    connectionId: string
  ): Promise<void> {
    const webhookTopics = [
      'orders/create',
      'orders/updated',
      'orders/paid',
      'app/uninstalled',
    ];
    
    const webhookUrl = `${config.apiBaseUrl}/api/v1/integrations/shopify/webhook`;
    
    for (const topic of webhookTopics) {
      try {
        const response = await fetch(
          `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
          {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              webhook: {
                topic,
                address: webhookUrl,
                format: 'json',
              },
            }),
          }
        );
        
        if (!response.ok) {
          console.error(`Failed to register webhook ${topic}:`, await response.text());
        } else {
          console.log(`✅ Registered Shopify webhook: ${topic}`);
        }
      } catch (error) {
        console.error(`Error registering webhook ${topic}:`, error);
      }
    }
  }
  
  // ============================================
  // WEBHOOK HANDLING
  // ============================================
  
  /**
   * Verify Shopify webhook HMAC signature
   */
  verifyWebhookSignature(
    body: string | Buffer,
    hmacHeader: string,
    secret: string
  ): boolean {
    const bodyString = typeof body === 'string' ? body : body.toString('utf8');
    const hash = crypto
      .createHmac('sha256', secret)
      .update(bodyString, 'utf8')
      .digest('base64');
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(hmacHeader)
      );
    } catch {
      return false;
    }
  }
  
  /**
   * Parse incoming Shopify order webhook
   */
  parseOrderWebhook(
    payload: ShopifyOrderWebhook,
    connectionId: string,
    businessId: string
  ): EcommerceOrder {
    return {
      id: uuidv4(),
      businessId,
      connectionId,
      platform: 'shopify',
      externalOrderId: payload.id.toString(),
      externalOrderNumber: payload.id.toString(),
      customerEmail: payload.email?.toLowerCase() || '',
      customerName: payload.customer 
        ? `${payload.customer.first_name} ${payload.customer.last_name}`.trim()
        : undefined,
      customerPhone: payload.customer?.phone || undefined,
      orderDate: payload.created_at,
      orderStatus: this.mapShopifyStatus(payload.financial_status, payload.fulfillment_status),
      orderTotal: Math.round(parseFloat(payload.total_price) * 100), // Convert to pence
      orderSubtotal: Math.round(parseFloat(payload.subtotal_price) * 100),
      shippingCost: 0, // Calculate from shipping_lines if needed
      currency: payload.currency,
      items: payload.line_items.map(item => ({
        externalId: item.id.toString(),
        sku: item.sku,
        name: item.title,
        quantity: item.quantity,
        unitPrice: Math.round(parseFloat(item.price) * 100),
        totalPrice: Math.round(parseFloat(item.price) * item.quantity * 100),
        variant: item.variant_title,
      })),
      itemCount: payload.line_items.reduce((sum, item) => sum + item.quantity, 0),
      fulfillmentType: payload.fulfillment_status === 'fulfilled' ? 'delivery' : 'delivery',
      shippingAddress: payload.shipping_address ? {
        name: payload.shipping_address.name,
        line1: payload.shipping_address.address1,
        line2: payload.shipping_address.address2,
        city: payload.shipping_address.city,
        county: payload.shipping_address.province,
        postcode: payload.shipping_address.zip,
        country: payload.shipping_address.country,
      } : undefined,
      processingStatus: 'pending',
      rawPayload: payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Map Shopify order status to our status
   */
  private mapShopifyStatus(
    financialStatus: string,
    fulfillmentStatus: string | null
  ): EcommerceOrder['orderStatus'] {
    if (financialStatus === 'refunded') return 'refunded';
    if (financialStatus === 'voided') return 'cancelled';
    if (fulfillmentStatus === 'fulfilled') return 'delivered';
    if (fulfillmentStatus === 'partial') return 'shipped';
    if (financialStatus === 'paid') return 'paid';
    if (financialStatus === 'pending') return 'pending';
    return 'processing';
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
   * Get connection by shop domain
   */
  async getConnectionByShop(shop: string): Promise<EcommerceConnection | null> {
    const connectionId = await redisClient.get(
      ECOMMERCE_REDIS_KEYS.connectionByShop('shopify', shop)
    );
    if (!connectionId) return null;
    return this.getConnection(connectionId);
  }
  
  /**
   * Get all connections for a business
   */
  async getBusinessConnections(businessId: string): Promise<EcommerceConnection[]> {
    const connectionIds = await redisClient.smembers(
      ECOMMERCE_REDIS_KEYS.businessConnections(businessId)
    );
    
    const connections = await Promise.all(
      connectionIds.map(id => this.getConnection(id))
    );
    
    return connections.filter((c): c is EcommerceConnection => c !== null);
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
   * Disconnect Shopify store
   */
  async disconnect(connectionId: string): Promise<void> {
    const connection = await this.getConnection(connectionId);
    if (!connection) return;
    
    // Remove from business connections
    await redisClient.srem(
      ECOMMERCE_REDIS_KEYS.businessConnections(connection.businessId),
      connectionId
    );
    
    // Remove shop lookup
    if (connection.platformShopId) {
      await redisClient.del(
        ECOMMERCE_REDIS_KEYS.connectionByShop('shopify', connection.platformShopId)
      );
    }
    
    // Update status to disconnected
    await this.updateConnectionStatus(connectionId, 'disconnected');
    
    // TODO: Unregister webhooks from Shopify
  }
  
  // ============================================
  // TOKEN ENCRYPTION
  // ============================================
  
  private encryptToken(token: string): string {
    // In production, use proper encryption (AES-256-GCM)
    // For now, base64 encode (NOT SECURE - replace in production!)
    return Buffer.from(token).toString('base64');
  }
  
  decryptToken(encryptedToken: string): string {
    // In production, use proper decryption
    return Buffer.from(encryptedToken, 'base64').toString('utf8');
  }
}

export const shopifyService = new ShopifyService();

