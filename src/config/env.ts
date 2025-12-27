// Environment configuration for Canny Carrot API
// Redis Cloud connection for Tees Valley loyalty platform

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Redis Cloud (EU-West-2 London - ideal for Tees Valley)
  redisUrl: process.env.REDIS_URL || '',
  
  // Stripe Payment Processing
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'canny-carrot-dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // CORS - Allow both apps
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8081,http://localhost:8082,http://localhost:3000,http://localhost:3001').split(','),
  
  // BID API Keys (Business Improvement Districts)
  bidKeys: {
    middlesbrough: process.env.BID_MIDDLESBROUGH_KEY || 'dev-middlesbrough-key',
    stockton: process.env.BID_STOCKTON_KEY || 'dev-stockton-key',
    darlington: process.env.BID_DARLINGTON_KEY || 'dev-darlington-key',
  },
  
  // Tees Valley Combined Authority
  tvca: {
    apiKey: process.env.TVCA_API_KEY || '',
    reportingEndpoint: process.env.TVCA_REPORTING_ENDPOINT || '',
  },
  
  // Shopify Integration
  shopify: {
    clientId: process.env.SHOPIFY_CLIENT_ID || '',
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET || '',
    redirectUri: process.env.SHOPIFY_REDIRECT_URI || 'http://localhost:3001/api/v1/integrations/shopify/callback',
    scopes: 'read_orders,read_customers',
  },
  
  // WooCommerce Integration (coming soon)
  woocommerce: {
    webhookSecret: process.env.WOOCOMMERCE_WEBHOOK_SECRET || '',
  },
  
  // eBay Integration
  ebay: {
    clientId: process.env.EBAY_CLIENT_ID || '',
    clientSecret: process.env.EBAY_CLIENT_SECRET || '',
    redirectUri: process.env.EBAY_REDIRECT_URI || 'http://localhost:3001/api/v1/integrations/ebay/callback',
    ruName: process.env.EBAY_RU_NAME || '', // eBay Redirect URI Name (required for OAuth)
  },
  
  // Etsy Integration (coming soon)
  etsy: {
    clientId: process.env.ETSY_CLIENT_ID || '',
    redirectUri: process.env.ETSY_REDIRECT_URI || 'http://localhost:3001/api/v1/integrations/etsy/callback',
  },
  
  // Amazon Integration (Marketplace & Stores)
  amazon: {
    sellerId: process.env.AMAZON_SELLER_ID || '',
    mwsAccessKey: process.env.AMAZON_MWS_ACCESS_KEY || '',
    mwsSecretKey: process.env.AMAZON_MWS_SECRET_KEY || '',
    spApiClientId: process.env.AMAZON_SP_API_CLIENT_ID || '',
    spApiClientSecret: process.env.AMAZON_SP_API_CLIENT_SECRET || '',
    spApiRefreshToken: process.env.AMAZON_SP_API_REFRESH_TOKEN || '',
    marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P', // UK marketplace
    redirectUri: process.env.AMAZON_REDIRECT_URI || 'http://localhost:3001/api/v1/integrations/amazon/callback',
  },
  
  // API base URL (for webhook registration)
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
};

// Validation
export const validateConfig = () => {
  if (!config.redisUrl) {
    throw new Error('REDIS_URL is required');
  }
  
  if (config.nodeEnv === 'production' && config.jwtSecret === 'canny-carrot-dev-secret-change-in-production') {
    throw new Error('JWT_SECRET must be changed in production');
  }
};
