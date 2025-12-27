import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { redisClient, connectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';

// Routes
import memberRoutes from './routes/members';
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

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));
app.use(express.json());

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
      customers: '/api/v1/members',
      rewards: '/api/v1/rewards',
      campaigns: '/api/v1/campaigns',
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get('/health', async (req, res) => {
  const redisStatus = redisClient.status === 'ready' ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    service: 'Canny Carrot API',
    version: '1.0.0',
    region: 'Tees Valley',
    redis: redisStatus,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1/members', memberRoutes);
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
  // On Vercel, connect Redis on first invocation
  // The connection will be reused across warm invocations
  connectRedis().catch(err => {
    console.error('Failed to connect to Redis on Vercel:', err);
    // Don't exit - let the function handle errors gracefully
  });
}

export default app;

