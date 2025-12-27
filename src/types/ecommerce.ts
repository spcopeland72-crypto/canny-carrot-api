// E-Commerce Integration Types for Canny Carrot
// Supports: Shopify, WooCommerce, eBay, Etsy, Vinted

// ============================================
// PLATFORM TYPES
// ============================================

export type EcommercePlatform = 
  | 'shopify'
  | 'woocommerce'
  | 'ebay'
  | 'etsy'
  | 'amazon'           // Amazon Marketplace (third-party sellers)
  | 'amazon_stores'    // Amazon Online Stores (brand storefronts)
  | 'vinted'
  | 'custom';

export type BusinessPresenceType = 
  | 'in_store_only'      // Physical location only
  | 'online_only'        // E-commerce only (no physical shop)
  | 'hybrid';            // Both in-store and online

export type StampChannel = 
  | 'in_store'           // QR scan at physical location
  | 'online'             // E-commerce order
  | 'click_collect';     // Order online, pickup in-store

// ============================================
// E-COMMERCE CONNECTION
// ============================================

export interface EcommerceConnection {
  id: string;
  businessId: string;
  platform: EcommercePlatform;
  status: EcommerceConnectionStatus;
  
  // OAuth credentials (stored encrypted)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  
  // Platform-specific identifiers
  platformShopId?: string;      // Shopify shop domain, eBay seller ID, etc.
  platformShopName?: string;    // Human-readable name
  storeUrl?: string;            // Full URL to store
  
  // Webhook configuration
  webhookId?: string;
  webhookSecret?: string;
  webhookUrl?: string;
  
  // Stamp settings
  settings: EcommerceStampSettings;
  
  // Sync status
  syncStatus: EcommerceSyncStatus;
  
  createdAt: string;
  updatedAt: string;
}

export type EcommerceConnectionStatus = 
  | 'pending'        // OAuth started, not completed
  | 'connected'      // Active and working
  | 'error'          // Connection error (needs attention)
  | 'disconnected'   // Manually disconnected
  | 'expired';       // Token expired, needs reauth

export interface EcommerceStampSettings {
  autoStampEnabled: boolean;
  
  // When to issue stamp
  orderStatusTrigger: OrderStatusTrigger;
  
  // Minimum order value to qualify for stamp (in pence)
  minimumOrderValue?: number;
  
  // Only count certain product categories/SKUs?
  qualifyingProducts?: 'all' | 'specific';
  qualifyingSkus?: string[];
  
  // Send notification to customer?
  notifyCustomer: boolean;
}

export type OrderStatusTrigger = 
  | 'order_placed'   // Immediately on order
  | 'payment_complete' // When payment confirmed (recommended)
  | 'order_shipped'  // When dispatched
  | 'order_delivered'; // When delivered

export interface EcommerceSyncStatus {
  lastSyncAt?: string;
  lastSyncStatus: 'success' | 'partial' | 'failed' | 'never';
  totalOrdersSynced: number;
  totalStampsIssued: number;
  unmatchedOrders: number;
  lastError?: string;
}

// ============================================
// INCOMING ORDERS
// ============================================

export interface EcommerceOrder {
  id: string;
  businessId: string;
  connectionId: string;
  platform: EcommercePlatform;
  
  // External reference
  externalOrderId: string;
  externalOrderNumber?: string; // Human-readable order #
  
  // Customer info
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  
  // Order details
  orderDate: string;
  orderStatus: EcommerceOrderStatus;
  orderTotal: number;        // In smallest currency unit (pence)
  orderSubtotal: number;     // Before tax/shipping
  shippingCost: number;
  currency: string;          // ISO 4217 (GBP, EUR, etc.)
  
  // Line items
  items: EcommerceOrderItem[];
  itemCount: number;
  
  // Fulfillment
  fulfillmentType: FulfillmentType;
  shippingAddress?: ShippingAddress;
  
  // Processing status
  processingStatus: OrderProcessingStatus;
  memberId?: string;         // Matched member (if found)
  stampId?: string;          // Issued stamp (if any)
  processingError?: string;
  processedAt?: string;
  
  // Raw data (for debugging)
  rawPayload?: Record<string, any>;
  
  createdAt: string;
  updatedAt: string;
}

export type EcommerceOrderStatus = 
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type FulfillmentType = 
  | 'delivery'       // Ship to customer
  | 'collection'     // Click & collect
  | 'digital'        // Digital product
  | 'local_pickup';  // In-store pickup

export type OrderProcessingStatus = 
  | 'pending'        // Awaiting processing
  | 'processing'     // Currently being processed
  | 'completed'      // Successfully processed, stamp issued
  | 'no_match'       // No member found for email
  | 'invited'        // No member found, invitation sent
  | 'skipped'        // Didn't meet criteria
  | 'failed';        // Error during processing

export interface EcommerceOrderItem {
  externalId?: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;   // In smallest currency unit
  totalPrice: number;
  variant?: string;    // Size, colour, etc.
}

export interface ShippingAddress {
  name?: string;
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
}

// ============================================
// EXTENDED BUSINESS MODEL
// ============================================

export interface BusinessEcommerceExtension {
  // Presence type
  presenceType: BusinessPresenceType;
  hasPhysicalLocation: boolean;
  hasOnlineStore: boolean;
  
  // Connected platforms
  ecommerceConnections: string[];  // Connection IDs
  activePlatforms: EcommercePlatform[];
  
  // Online store settings
  websiteUrl?: string;
  enableClickCollect: boolean;
  
  // Customer-facing info
  channels: BusinessChannels;
}

export interface BusinessChannels {
  inStore: boolean;
  online: boolean;
  clickCollect: boolean;
  delivery: boolean;
}

// ============================================
// EXTENDED STAMP MODEL
// ============================================

export interface StampEcommerceExtension {
  // Channel info
  channel: StampChannel;
  
  // E-commerce details (if online)
  ecommerceOrderId?: string;
  ecommercePlatform?: EcommercePlatform;
  orderValue?: number;
  orderCurrency?: string;
  orderReference?: string;
}

// ============================================
// MEMBER EXTENSIONS
// ============================================

export interface MemberEcommerceExtension {
  // Additional emails for order matching
  linkedEmails: string[];
  
  // Order history summary
  onlineOrderCount: number;
  onlineStampCount: number;
  lastOnlineOrderDate?: string;
  
  // Preferred shopping methods
  preferredChannels: StampChannel[];
}

// ============================================
// WEBHOOK PAYLOADS
// ============================================

export interface ShopifyOrderWebhook {
  id: number;
  email: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
  };
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    sku: string;
    variant_title: string;
  }>;
  shipping_address?: {
    name: string;
    address1: string;
    address2: string;
    city: string;
    province: string;
    zip: string;
    country: string;
  };
}

export interface WooCommerceOrderWebhook {
  id: number;
  order_key: string;
  status: string;
  date_created: string;
  total: string;
  total_tax: string;
  currency: string;
  billing: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    address_1: string;
    address_2: string;
    city: string;
    postcode: string;
    country: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    price: number;
    sku: string;
  }>;
}

// eBay Fulfillment API Order Response
export interface EbayOrder {
  orderId: string;
  legacyOrderId?: string;
  creationDate: string;
  lastModifiedDate: string;
  orderFulfillmentStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'FULFILLED';
  orderPaymentStatus: 'PENDING' | 'FAILED' | 'PAID' | 'PARTIALLY_REFUNDED' | 'FULLY_REFUNDED';
  sellerId: string;
  buyer?: {
    username?: string;
    buyerRegistrationAddress?: {
      fullName?: string;
      email?: string;
      primaryPhone?: {
        phoneNumber?: string;
      };
    };
  };
  pricingSummary?: {
    priceSubtotal?: { value: string; currency: string };
    deliveryCost?: { value: string; currency: string };
    tax?: { value: string; currency: string };
    total?: { value: string; currency: string };
  };
  cancelStatus?: {
    cancelState: string;
    cancelRequests?: Array<{
      cancelReason?: string;
      cancelRequestedDate?: string;
    }>;
  };
  paymentSummary?: {
    totalDueSeller?: { value: string; currency: string };
    payments?: Array<{
      paymentMethod: string;
      paymentStatus: string;
      paymentDate: string;
      amount: { value: string; currency: string };
    }>;
  };
  fulfillmentStartInstructions?: Array<{
    fulfillmentInstructionsType: string;
    shippingStep?: {
      shipTo?: {
        fullName?: string;
        contactAddress?: {
          addressLine1?: string;
          addressLine2?: string;
          city?: string;
          stateOrProvince?: string;
          postalCode?: string;
          countryCode?: string;
        };
        primaryPhone?: {
          phoneNumber?: string;
        };
        email?: string;
      };
      shippingCarrierCode?: string;
      shippingServiceCode?: string;
    };
  }>;
  lineItems?: EbayLineItem[];
  salesRecordReference?: string;
  totalFeeBasisAmount?: { value: string; currency: string };
  totalMarketplaceFee?: { value: string; currency: string };
}

export interface EbayLineItem {
  lineItemId: string;
  legacyItemId?: string;
  legacyVariationId?: string;
  sku?: string;
  title: string;
  quantity: number;
  lineItemCost?: { value: string; currency: string };
  total?: { value: string; currency: string };
  deliveryCost?: { value: string; currency: string };
  discountedLineItemCost?: { value: string; currency: string };
  lineItemFulfillmentStatus: string;
  soldFormat?: string;
  listingMarketplaceId?: string;
  purchaseMarketplaceId?: string;
  itemLocation?: {
    countryCode?: string;
    postalCode?: string;
  };
  appliedPromotions?: Array<{
    promotionId: string;
    description?: string;
    discountAmount?: { value: string; currency: string };
  }>;
}

export interface EbayOrderNotification {
  notificationType: string;
  publishTime: string;
  data: {
    orderId?: string;
    username?: string;
    userId?: string;
    eventDate?: string;
    [key: string]: any;
  };
}

export interface EtsyReceipt {
  receipt_id: number;
  buyer_email: string;
  buyer_user_id: number;
  name: string;
  created_timestamp: number;
  grandtotal: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  status: string;
  transactions: Array<{
    transaction_id: number;
    title: string;
    quantity: number;
    price: {
      amount: number;
      divisor: number;
      currency_code: string;
    };
  }>;
}

// Amazon SP-API Order Response
export interface AmazonOrder {
  AmazonOrderId: string;
  SellerOrderId?: string;
  PurchaseDate: string;
  LastUpdateDate: string;
  OrderStatus: AmazonOrderStatus;
  FulfillmentChannel: 'AFN' | 'MFN'; // AFN = FBA, MFN = Merchant Fulfilled
  SalesChannel?: string;
  OrderChannel?: string;
  ShipServiceLevel?: string;
  OrderTotal?: {
    CurrencyCode: string;
    Amount: string;
  };
  NumberOfItemsShipped: number;
  NumberOfItemsUnshipped: number;
  PaymentMethod?: string;
  PaymentMethodDetails?: string[];
  MarketplaceId: string;
  ShipmentServiceLevelCategory?: string;
  OrderType: 'StandardOrder' | 'LongLeadTimeOrder' | 'Preorder' | 'BackOrder' | 'SourcingOnDemandOrder';
  EarliestShipDate?: string;
  LatestShipDate?: string;
  EarliestDeliveryDate?: string;
  LatestDeliveryDate?: string;
  IsBusinessOrder: boolean;
  IsPrime: boolean;
  IsGlobalExpressEnabled: boolean;
  IsPremiumOrder: boolean;
  IsSoldByAB: boolean;
  IsIBA: boolean;
  BuyerInfo?: {
    BuyerEmail?: string;
    BuyerName?: string;
  };
  ShippingAddress?: {
    Name?: string;
    AddressLine1?: string;
    AddressLine2?: string;
    AddressLine3?: string;
    City?: string;
    County?: string;
    District?: string;
    StateOrRegion?: string;
    PostalCode?: string;
    CountryCode?: string;
    Phone?: string;
  };
}

export type AmazonOrderStatus = 
  | 'Pending'           // Order placed, payment not confirmed
  | 'Unshipped'         // Payment confirmed, awaiting shipment
  | 'PartiallyShipped'  // Some items shipped
  | 'Shipped'           // All items shipped
  | 'InvoiceUnconfirmed'// Invoice pending (business orders)
  | 'Canceled'          // Order cancelled
  | 'Unfulfillable';    // Cannot be fulfilled

export interface AmazonOrderItem {
  ASIN: string;
  SellerSKU?: string;
  OrderItemId: string;
  Title: string;
  QuantityOrdered: number;
  QuantityShipped: number;
  ProductInfo?: {
    NumberOfItems?: number;
  };
  ItemPrice?: {
    CurrencyCode: string;
    Amount: string;
  };
  ItemTax?: {
    CurrencyCode: string;
    Amount: string;
  };
  PromotionDiscount?: {
    CurrencyCode: string;
    Amount: string;
  };
  IsGift: boolean;
  ConditionId?: string;
  ConditionSubtypeId?: string;
  ConditionNote?: string;
}

// Amazon Notification (SQS message from SP-API)
export interface AmazonOrderNotification {
  NotificationVersion: string;
  NotificationType: 'ORDER_CHANGE' | 'FULFILLMENT_ORDER_STATUS';
  PayloadVersion: string;
  EventTime: string;
  Payload: {
    OrderChangeNotification?: {
      AmazonOrderId: string;
      OrderChangeType: 'OrderStatusChange' | 'BuyerRequestedCancel';
      OrderStatus: AmazonOrderStatus;
    };
  };
  NotificationMetadata: {
    ApplicationId: string;
    SubscriptionId: string;
    PublishTime: string;
    NotificationId: string;
  };
}

// ============================================
// API RESPONSES
// ============================================

export interface ConnectPlatformResponse {
  success: boolean;
  connectionId?: string;
  redirectUrl?: string;  // For OAuth flows
  error?: string;
}

export interface OrderProcessingResult {
  orderId: string;
  status: OrderProcessingStatus;
  memberId?: string;
  stampId?: string;
  message: string;
  invitationSent?: boolean;
}

export interface EcommerceAnalytics {
  businessId: string;
  period: string;  // e.g., "2024-12"
  
  // By channel
  byChannel: {
    inStore: ChannelStats;
    online: ChannelStats;
    clickCollect: ChannelStats;
  };
  
  // By platform (online only)
  byPlatform: Record<EcommercePlatform, PlatformStats>;
  
  // Totals
  totals: {
    stamps: number;
    redemptions: number;
    orderValue: number;
    uniqueCustomers: number;
  };
}

export interface ChannelStats {
  stamps: number;
  redemptions: number;
  uniqueCustomers: number;
  averageOrderValue?: number;
}

export interface PlatformStats extends ChannelStats {
  ordersReceived: number;
  ordersProcessed: number;
  matchRate: number;  // % of orders matched to members
}

// ============================================
// REDIS KEY HELPERS
// ============================================

export const ECOMMERCE_REDIS_KEYS = {
  // Connections
  connection: (connectionId: string) => 
    `ecommerce:connection:${connectionId}`,
  
  businessConnections: (businessId: string) => 
    `business:${businessId}:ecommerce:connections`,
  
  connectionByShop: (platform: string, shopId: string) => 
    `ecommerce:lookup:${platform}:${shopId}`,
  
  // Orders
  order: (orderId: string) => 
    `ecommerce:order:${orderId}`,
  
  orderQueue: () => 
    'ecommerce:orders:pending',
  
  orderByExternal: (platform: string, externalId: string) => 
    `ecommerce:order:lookup:${platform}:${externalId}`,
  
  businessOrders: (businessId: string) => 
    `business:${businessId}:ecommerce:orders`,
  
  unmatchedOrders: (businessId: string) => 
    `business:${businessId}:ecommerce:unmatched`,
  
  // Member lookup
  memberByEmail: (email: string) => 
    `member:email:${email.toLowerCase()}`,
  
  memberLinkedEmails: (memberId: string) => 
    `member:${memberId}:linked_emails`,
  
  // Webhook secrets
  webhookSecret: (connectionId: string) => 
    `ecommerce:webhook:secret:${connectionId}`,
  
  // Analytics
  dailyChannelStats: (businessId: string, date: string, channel: StampChannel) => 
    `analytics:${businessId}:${date}:channel:${channel}`,
  
  dailyPlatformStats: (businessId: string, date: string, platform: EcommercePlatform) => 
    `analytics:${businessId}:${date}:platform:${platform}`,
};

