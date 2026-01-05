/**
 * Redis Proxy Route - For mobile apps to access Redis via HTTP
 * 
 * This endpoint allows the business and customer apps to perform
 * Redis operations through the API, enabling offline-first sync.
 */

import express from 'express';
import { redisClient, REDIS_KEYS } from '../config/redis';

const router = express.Router();

/**
 * Execute Redis command via HTTP API
 * POST /api/v1/redis/:command
 * Body: { args: any[] }
 */
router.post('/:command', async (req, res) => {
  try {
    const { command } = req.params;
    const { args = [] } = req.body;

    // Log all Redis requests for debugging
    console.log(`\n🔵 [API SERVER] Redis command received: ${command}`, {
      key: args[0],
      argsCount: args.length,
      timestamp: new Date().toISOString()
    });

    // Security: Only allow safe Redis commands
    const allowedCommands = [
      'get', 'set', 'del', 'exists', 'keys', 'mget', 'mset',
      'sadd', 'smembers', 'srem', 'scard',
      'hget', 'hset', 'hgetall', 'hincrby',
      'lpush', 'rpush', 'lrange', 'llen',
      'setex', 'expire', 'ttl',
    ];

    if (!allowedCommands.includes(command.toLowerCase())) {
      return res.status(400).json({
        error: `Command '${command}' is not allowed`,
        allowedCommands,
      });
    }

    // Log customer registration data when saving to Redis
    if (command.toLowerCase() === 'set' && args.length >= 2 && args[0].startsWith('customer:')) {
      try {
        const customerData = JSON.parse(args[1]);
        console.log('\n🥕 ============================================');
        console.log('🥕 NEW CUSTOMER REGISTRATION');
        console.log('🥕 ============================================');
        console.log('📋 Customer ID:', customerData.profile?.id || 'N/A');
        console.log('👤 Name:', customerData.profile?.name || 'N/A');
        console.log('📧 Email:', customerData.profile?.email || 'N/A');
        console.log('📞 Phone:', customerData.profile?.phone || 'N/A');
        console.log('📍 Postcode:', customerData.profile?.postcode || 'N/A');
        console.log('📅 Date of Birth:', customerData.profile?.dateOfBirth || 'N/A');
        console.log('📊 Status:', customerData.status || 'N/A');
        console.log('📅 Join Date:', customerData.joinDate || 'N/A');
        console.log('🔔 Notification Preferences:', JSON.stringify(customerData.profile?.preferences || {}, null, 2));
        console.log('🥕 ============================================\n');
      } catch (parseError: any) {
        console.error('❌ [API SERVER] Error parsing customer registration data:', parseError.message);
        console.log('[Redis] SET customer data (non-JSON or parse failed)');
      }
    }

    // Log business registration data when saving to Redis
    if (command.toLowerCase() === 'set' && args.length >= 2 && args[0].startsWith('business:')) {
      try {
        const businessData = JSON.parse(args[1]);
        console.log('\n🥕 ============================================');
        console.log('🥕 NEW BUSINESS REGISTRATION');
        console.log('🥕 ============================================');
        console.log('📋 Business ID:', businessData.profile?.id || 'N/A');
        console.log('🏢 Business Name:', businessData.profile?.name || 'N/A');
        console.log('📧 Email:', businessData.profile?.email || 'N/A');
        console.log('📞 Phone:', businessData.profile?.phone || 'N/A');
        console.log('👤 Contact Name:', businessData.profile?.contactName || 'N/A');
        console.log('📍 Address Line 1:', businessData.profile?.addressLine1 || 'N/A');
        console.log('📍 Address Line 2:', businessData.profile?.addressLine2 || 'N/A');
        console.log('🏙️  City:', businessData.profile?.city || 'N/A');
        console.log('📮 Postcode:', businessData.profile?.postcode || 'N/A');
        console.log('🏷️  Business Type:', businessData.profile?.businessType || 'N/A');
        console.log('🌐 Website:', businessData.profile?.website || 'N/A');
        console.log('💼 Subscription Tier:', businessData.subscriptionTier || 'N/A');
        console.log('📊 Status:', businessData.status || 'N/A');
        console.log('📅 Join Date:', businessData.joinDate || 'N/A');
        console.log('🥕 ============================================\n');
      } catch (parseError: any) {
        console.error('❌ [API SERVER] Error parsing business registration data:', parseError.message);
        console.log('[Redis] SET business data (non-JSON or parse failed)');
      }
    }

    // Log when adding business to list
    if (command.toLowerCase() === 'sadd' && args.length >= 2 && args[0] === 'businesses:all') {
      console.log('✅ Adding business to businesses list:', args[1]);
    }

    // Log when adding customer to list
    if (command.toLowerCase() === 'sadd' && args.length >= 2 && args[0] === 'customers:all') {
      console.log('✅ Adding customer to customers list:', args[1]);
    }

    // Log when checking business list
    if (command.toLowerCase() === 'smembers' && args.length >= 1 && args[0] === 'businesses:all') {
      console.log('🔍 [API SERVER] Checking businesses:all list...');
    }

    // Execute command
    let result;
    if (args.length === 0) {
      result = await (redisClient as any)[command]();
    } else if (args.length === 1) {
      result = await (redisClient as any)[command](args[0]);
    } else if (args.length === 2) {
      result = await (redisClient as any)[command](args[0], args[1]);
    } else if (args.length === 3) {
      result = await (redisClient as any)[command](args[0], args[1], args[2]);
    } else {
      result = await (redisClient as any)[command](...args);
    }

    console.log(`✅ [API SERVER] Redis command ${command} completed successfully`);
    
    // Log result for smembers on businesses:all
    if (command.toLowerCase() === 'smembers' && args.length >= 1 && args[0] === 'businesses:all') {
      console.log(`📋 [API SERVER] businesses:all contains ${Array.isArray(result) ? result.length : 0} business IDs:`, Array.isArray(result) ? result.slice(0, 5) : result);
    }
    
    res.json({ data: result });
  } catch (error: any) {
    const command = req.params.command || 'unknown';
    console.error('❌ [API SERVER] Redis proxy error:', {
      command,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({
      error: error.message || 'Redis operation failed',
    });
  }
});

/**
 * Health check for Redis connection
 * GET /api/v1/redis/health
 */
router.get('/health', async (req, res) => {
  try {
    const status = redisClient.status;
    const ping = await redisClient.ping();
    
    res.json({
      status: status === 'ready' ? 'connected' : status,
      ping: ping === 'PONG' ? 'ok' : 'failed',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;












