// WooCommerce Integration Service
// Handles OAuth 1.0a, API calls, and webhook verification

import crypto from 'crypto';
import { config } from '../config/env';
import { 
  EcommerceConnection, 
  EcommerceOrder,
  EcommerceOrderItem,
  EcommerceConnectionStatus,
  EcommerceOrderStatus
} from '../types/ecommerce';
import { redisClient } from '../config/redis';
import { ECOMMERCE_REDIS_KEYS } from '../types/ecommerce';
import { v4 as uuidv4 } from 'uuid';

// WooCommerce API version
const WOOCOMMERCE_API_VERSION = 'wc/v3';

export class WooCommerceService {
  
  // ============================================
  // OAUTH 1.0A FLOW
  // ============================================
  
  /**
   * Generate OAuth 1.0a signature
   * WooCommerce uses OAuth 1.0a (not OAuth 2.0)
   */
  private generateOAuthSignature(
    method: string,
    url: string,
    params: Record<string, string>,
    consumerSecret: string,
    tokenSecret: string = ''
  ): string {
    // Sort parameters
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    // Create signature base string
    const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
    
    // Create signing key
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
    
    // Generate HMAC-SHA1 signature
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(signatureBase)
      .digest('base64');
    
    return signature;
  }
  
  /**
   * Generate OAuth 1.0a authorization header
   */
  private generateOAuthHeader(
    method: string,
    url: string,
    consumerKey: string,
    consumerSecret: string,
    token?: string,
    tokenSecret?: string
  ): string {
    const params: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0',
    };
    
    if (token) {
      params.oauth_token = token;
    }
    
    // Generate signature
    const signature = this.generateOAuthSignature(
      method,
      url,
      params,
      consumerSecret,
      tokenSecret
    );
    params.oauth_signature = signature;
    
    // Build header
    const headerParams = Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(params[key])}"`)
      .join(', ');
    
    return `OAuth ${headerParams}`;
  }
  
  /**
   * Test connection to WooCommerce store
   */
  async testConnection(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string
  ): Promise<{ success: boolean; storeName?: string; error?: string }> {
    try {
      const url = `${storeUrl}/wp-json/${WOOCOMMERCE_API_VERSION}/system_status`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.generateOAuthHeader('GET', url, consumerKey, consumerSecret),
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as {
        environment?: {
          site_name?: string;
        };
      };
      
      return {
        success: true,
        storeName: data.environment?.site_name || 'WooCommerce Store',
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
  
  /**
   * Create and store a new WooCommerce connection
   */
  async createConnection(
    businessId: string,
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string
  ): Promise<EcommerceConnection> {
    // Normalize store URL (remove trailing slash)
    const normalizedUrl = storeUrl.replace(/\/$/, '');
    
    // Test connection first
    const test = await this.testConnection(normalizedUrl, consumerKey, consumerSecret);
    if (!test.success) {
      throw new Error(`Connection test failed: ${test.error}`);
    }
    
    // Check if connection already exists
    const existingKey = ECOMMERCE_REDIS_KEYS.connectionByShop('woocommerce', normalizedUrl);
    const existingId = await redisClient.get(existingKey);
    
    if (existingId) {
      const existing = await redisClient.get(ECOMMERCE_REDIS_KEYS.connection(existingId));
      if (existing) {
        const conn = JSON.parse(existing) as EcommerceConnection;
        if (conn.businessId === businessId) {
          return conn;
        }
      }
    }
    
    // Create new connection
    const connectionId = uuidv4();
    const now = new Date().toISOString();
    
    // Encrypt credentials (in production, use proper encryption)
    const encryptedKey = Buffer.from(consumerKey).toString('base64');
    const encryptedSecret = Buffer.from(consumerSecret).toString('base64');
    
    const connection: EcommerceConnection = {
      id: connectionId,
      businessId,
      platform: 'woocommerce',
      status: 'connected',
      accessToken: encryptedKey, // Store consumer key as accessToken
      refreshToken: encryptedSecret, // Store consumer secret as refreshToken
      platformShopId: normalizedUrl,
      platformShopName: test.storeName || 'WooCommerce Store',
      storeUrl: normalizedUrl,
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
      createdAt: now,
      updatedAt: now,
    };
    
    // Store connection
    await redisClient.set(
      ECOMMERCE_REDIS_KEYS.connection(connectionId),
      JSON.stringify(connection)
    );
    
    // Store lookup
    await redisClient.set(existingKey, connectionId);
    
    // Store by business
    await redisClient.sadd(
      ECOMMERCE_REDIS_KEYS.businessConnections(businessId),
      connectionId
    );
    
    return connection;
  }
  
  // ============================================
  // API CALLS
  // ============================================
  
  /**
   * Make authenticated API call to WooCommerce
   */
  private async apiCall(
    connection: EcommerceConnection,
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<any> {
    if (!connection.storeUrl || !connection.accessToken || !connection.refreshToken) {
      throw new Error('WooCommerce connection not properly configured');
    }
    
    // Decrypt credentials
    const consumerKey = Buffer.from(connection.accessToken, 'base64').toString('utf8');
    const consumerSecret = Buffer.from(connection.refreshToken, 'base64').toString('utf8');
    
    const url = `${connection.storeUrl}/wp-json/${WOOCOMMERCE_API_VERSION}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': this.generateOAuthHeader('GET', url, consumerKey, consumerSecret),
      'Content-Type': 'application/json',
    };
    
    const options: RequestInit = {
      method,
      headers,
    };
    
    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get orders from WooCommerce
   */
  async getOrders(
    connection: EcommerceConnection,
    after?: string, // ISO date
    limit: number = 100
  ): Promise<EcommerceOrder[]> {
    const params = new URLSearchParams({
      per_page: limit.toString(),
      orderby: 'date',
      order: 'desc',
    });
    
    if (after) {
      params.append('after', after);
    }
    
    const orders = await this.apiCall(
      connection,
      `/orders?${params.toString()}`
    ) as WooCommerceOrder[];
    
    return orders.map(order => this.transformOrder(order, connection.id, connection.businessId));
  }
  
  /**
   * Get a single order by ID
   */
  async getOrder(
    connection: EcommerceConnection,
    orderId: string
  ): Promise<EcommerceOrder | null> {
    try {
      const order = await this.apiCall(
        connection,
        `/orders/${orderId}`
      ) as WooCommerceOrder;
      
      return this.transformOrder(order, connection.id, connection.businessId);
    } catch (error) {
      if ((error as Error).message.includes('404')) {
        return null;
      }
      throw error;
    }
  }
  
  /**
   * Transform WooCommerce order to our format
   */
  private transformOrder(
    order: WooCommerceOrder,
    connectionId: string,
    businessId: string
  ): EcommerceOrder {
    const orderId = uuidv4();
    const orderTotal = parseFloat(order.total || '0');
    const orderSubtotal = orderTotal; // WooCommerce total includes everything
    const shippingCost = 0; // Would need to extract from order if available
    
    return {
      id: orderId,
      businessId,
      connectionId,
      platform: 'woocommerce',
      externalOrderId: order.id.toString(),
      externalOrderNumber: order.number || order.id.toString(),
      customerEmail: order.billing?.email || '',
      customerName: order.billing 
        ? `${order.billing.first_name || ''} ${order.billing.last_name || ''}`.trim()
        : undefined,
      orderDate: order.date_created || new Date().toISOString(),
      orderStatus: this.mapOrderStatus(order.status),
      orderTotal: Math.round(orderTotal * 100), // Convert to pence
      orderSubtotal: Math.round(orderSubtotal * 100),
      shippingCost: Math.round(shippingCost * 100),
      currency: order.currency || 'GBP',
      items: order.line_items?.map(item => ({
        externalId: item.id.toString(),
        sku: item.sku,
        name: item.name,
        quantity: item.quantity || 1,
        unitPrice: Math.round(parseFloat(item.price || '0') * 100), // Convert to pence
        totalPrice: Math.round(parseFloat(item.total || '0') * 100),
      })) || [],
      itemCount: order.line_items?.length || 0,
      fulfillmentType: 'delivery', // Default, could be determined from shipping method
      shippingAddress: order.shipping ? {
        line1: order.shipping.address_1 || '',
        city: order.shipping.city || '',
        postcode: order.shipping.postcode || '',
        country: order.shipping.country || '',
      } : undefined,
      processingStatus: 'pending',
      createdAt: order.date_created || new Date().toISOString(),
      updatedAt: order.date_modified || new Date().toISOString(),
    };
  }
  
  /**
   * Map WooCommerce order status to our format
   */
  private mapOrderStatus(status: string): EcommerceOrder['orderStatus'] {
    const statusMap: Record<string, EcommerceOrder['orderStatus']> = {
      'pending': 'pending',
      'processing': 'processing',
      'on-hold': 'pending',
      'completed': 'completed',
      'cancelled': 'cancelled',
      'refunded': 'refunded',
      'failed': 'cancelled',
    };
    
    return statusMap[status.toLowerCase()] || 'pending';
  }
  
  // ============================================
  // WEBHOOK VERIFICATION
  // ============================================
  
  /**
   * Verify WooCommerce webhook signature
   * WooCommerce webhooks can be signed with HMAC-SHA256
   */
  verifyWebhookSignature(
    body: string,
    signature: string,
    secret: string
  ): boolean {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(hash)
    );
  }
  
  /**
   * Process WooCommerce webhook
   */
  async processWebhook(
    connectionId: string,
    event: string,
    orderData: WooCommerceOrder
  ): Promise<EcommerceOrder> {
    const connectionData = await redisClient.get(ECOMMERCE_REDIS_KEYS.connection(connectionId));
    if (!connectionData) {
      throw new Error('Connection not found');
    }
    
    const connection = JSON.parse(connectionData) as EcommerceConnection;
    
    // Transform order
    const order = this.transformOrder(orderData, connectionId, connection.businessId);
    
    // Check if order meets stamp criteria
    if (this.shouldIssueStamp(order, connection)) {
      // Order will be processed by order-processor.service
      return order;
    }
    
    return order;
  }
  
  /**
   * Check if order should receive a stamp
   */
  private shouldIssueStamp(
    order: EcommerceOrder,
    connection: EcommerceConnection
  ): boolean {
    const settings = connection.settings;
    
    // Check if auto-stamp is enabled
    if (!settings.autoStampEnabled) {
      return false;
    }
    
    // Check order status matches trigger
    const statusMatches = this.checkStatusTrigger(order.orderStatus, settings.orderStatusTrigger);
    if (!statusMatches) {
      return false;
    }
    
    // Check minimum order value
    if (settings.minimumOrderValue && order.orderTotal < settings.minimumOrderValue / 100) {
      return false;
    }
    
    // Must have customer email
    if (!order.customerEmail) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if order status matches trigger
   */
  private checkStatusTrigger(
    orderStatus: string,
    trigger: string
  ): boolean {
    switch (trigger) {
      case 'order_placed':
        return true;
      case 'payment_complete':
        return ['processing', 'completed'].includes(orderStatus);
      case 'order_shipped':
        return ['completed'].includes(orderStatus);
      case 'order_delivered':
        return ['completed'].includes(orderStatus);
      default:
        return orderStatus === 'processing';
    }
  }
}

// WooCommerce API Types
interface WooCommerceOrder {
  id: number;
  number?: string;
  status: string;
  currency: string;
  date_created: string;
  date_modified: string;
  total: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address_1?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
  shipping?: {
    address_1?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
  line_items?: Array<{
    id: number;
    name: string;
    sku?: string;
    quantity?: number;
    price?: string;
    total?: string;
  }>;
}

export const wooCommerceService = new WooCommerceService();

