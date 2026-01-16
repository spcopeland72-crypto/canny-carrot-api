import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { redisClient, connectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { apiLogger } from './middleware/apiLogger';
import { initializeRepositoryCopies } from './services/repositoryCopyService';

// Routes
import customerRoutes from './routes/customers';
import businessRoutes from './routes/businesses';
import rewardRoutes from './routes/rewards';
import stampRoutes from './routes/stamps';
import analyticsRoutes from './routes/analytics';
import bidRoutes from './routes/bid'; // Business Improvement District routes
import campaignRoutes from './routes/campaigns';
import gamificationRoutes from './routes/gamification';
import notificationRoutes from './routes/notifications';
import paymentRoutes from './routes/payments';
import integrationRoutes from './routes/integrations';
import personalisationRoutes from './routes/personalisation';
import redisRoutes from './routes/redis'; // Redis proxy for mobile apps
import authRoutes from './routes/auth'; // Authentication routes
import suggestionsRoutes from './routes/suggestions'; // Autocomplete suggestions
import userSubmissionsRoutes from './routes/userSubmissions'; // User submissions for admin review
import searchRoutes from './routes/search'; // GeoSearch routes

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));
app.use(express.json());

// Comprehensive API Logger - captures ALL requests and responses to /tmp for Vercel access
app.use(apiLogger);

// Debug middleware to see what paths Express receives
app.use((req, res, next) => {
  console.log('🔍 [INDEX] Request received:', {
    method: req.method,
    url: req.url,
    path: req.path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
  });
  next();
});

// Root route - API information
app.get('/', (req, res) => {
  res.json({
    service: 'Canny Carrot API',
    version: '1.0.0',
    region: 'Tees Valley',
    status: 'online',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      redis: '/api/v1/redis',
      businesses: '/api/v1/businesses',
      customers: '/api/v1/customers',
      rewards: '/api/v1/rewards',
      campaigns: '/api/v1/campaigns',
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get('/health', async (req, res) => {
  let redisStatus = 'disconnected';
  let redisError = null;
  
  // Actually test Redis connection (since we use lazyConnect)
  try {
    await connectRedis();
    const pingResult = await redisClient.ping();
    redisStatus = pingResult === 'PONG' ? 'connected' : 'disconnected';
  } catch (error: any) {
    redisStatus = 'error';
    redisError = error.message;
  }
  
  res.json({
    status: 'ok',
    service: 'Canny Carrot API',
    version: '1.0.0',
    region: 'Tees Valley',
    redis: redisStatus,
    redisError: redisError,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/businesses', businessRoutes);
app.use('/api/v1/rewards', rewardRoutes);
app.use('/api/v1/stamps', stampRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/bid', bidRoutes); // BID Manager dashboards
app.use('/api/v1/campaigns', campaignRoutes);
app.use('/api/v1/gamification', gamificationRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/integrations', integrationRoutes); // E-commerce integrations
app.use('/api/v1/personalisation', personalisationRoutes); // AI personalization
app.use('/api/v1/redis', redisRoutes); // Redis proxy for offline-first sync
app.use('/api/v1/suggestions', suggestionsRoutes); // Autocomplete suggestions
app.use('/api/v1/user-submissions', userSubmissionsRoutes); // User submissions for admin review
app.use('/api/v1/search', searchRoutes); // GeoSearch routes
console.log('✅ [INDEX] Registering auth routes at /api/v1/auth');
console.log('✅ [INDEX] Auth routes type:', typeof authRoutes);
app.use('/api/v1/auth', authRoutes); // Authentication routes
console.log('✅ [INDEX] Auth routes registered successfully');

// Error handling
app.use(errorHandler);

// Connect to Redis on startup (works for both traditional server and serverless)
// For Vercel serverless: connection is reused across invocations within the same container
// For traditional server: connection is established once on startup
if (!process.env.VERCEL) {
  // Only start traditional server if NOT running on Vercel
  const startServer = async () => {
    try {
      // Connect to Redis
      await connectRedis();
      console.log('🔴 Redis connected successfully');

      // Start Express
      app.listen(config.port, () => {
        console.log(`
🥕 ============================================
🥕  CANNY CARROT API SERVER
🥕 ============================================
🥕  Status:    Running
🥕  Port:      ${config.port}
🥕  Region:    Tees Valley
🥕  Redis:     Connected
🥕 ============================================
🥕  Powering local business loyalty!
🥕 ============================================
        `);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  };

  startServer();
} else {
  // On Vercel, don't pre-connect Redis
  // Connection will happen lazily when Redis is first used
  // This prevents timeout errors during cold starts
  // The connection will be reused across warm invocations
  console.log('⚡ Running on Vercel - Redis will connect on first use');
}

export default app;

