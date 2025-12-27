/**
 * Redis Proxy Route - For mobile apps to access Redis via HTTP
 * 
 * This endpoint allows the business and customer apps to perform
 * Redis operations through the API, enabling offline-first sync.
 */

import express from 'express';
import { redisClient, REDIS_KEYS } from '../config/redis';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Execute Redis command via HTTP API
 * POST /api/v1/redis/:command
 * Body: { args: any[] }
 */
router.post('/:command', async (req, res) => {
  const { command } = req.params;
  try {
    const { args = [] } = req.body;

    // Log all Redis requests for debugging
    logger.redis.info(`Redis command received: ${command}`, {
      command,
      key: args[0],
      argsCount: args.length,
      args: args.length > 2 ? args.slice(0, 2) : args, // Log first 2 args to avoid huge payloads
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
        const businessId = businessData.profile?.id || args[0].replace('business:', '');
        logger.registration.info('NEW BUSINESS REGISTRATION - SET command', {
          businessId,
          businessName: businessData.profile?.name,
          email: businessData.profile?.email,
          phone: businessData.profile?.phone,
          contactName: businessData.profile?.contactName,
          status: businessData.status,
          subscriptionTier: businessData.subscriptionTier,
          fullData: businessData,
        });
        console.log('\n🥕 ============================================');
        console.log('🥕 NEW BUSINESS REGISTRATION');
        console.log('🥕 ============================================');
        console.log('📋 Business ID:', businessId);
        console.log('🏢 Business Name:', businessData.profile?.name || 'N/A');
        console.log('📧 Email:', businessData.profile?.email || 'N/A');
        console.log('🥕 ============================================\n');
      } catch (parseError: any) {
        logger.registration.error('Error parsing business registration data', parseError, {
          key: args[0],
          dataLength: args[1]?.length,
        });
        console.error('❌ [API SERVER] Error parsing business registration data:', parseError.message);
      }
    }

    // Log when adding business to list
    if (command.toLowerCase() === 'sadd' && args.length >= 2 && args[0] === 'businesses:all') {
      const businessId = args[1];
      logger.registration.info('Adding business ID to businesses:all set', {
        businessId,
        setKey: 'businesses:all',
      });
      logger.redis.info('SADD command - businesses:all', {
        command: 'sadd',
        set: 'businesses:all',
        member: businessId,
      });
      console.log('✅ Adding business to businesses list:', businessId);
    }

    // Log when adding customer to list
    if (command.toLowerCase() === 'sadd' && args.length >= 2 && args[0] === 'customers:all') {
      const customerId = args[1];
      logger.registration.info('Adding customer ID to customers:all set', {
        customerId,
        setKey: 'customers:all',
      });
      logger.redis.info('SADD command - customers:all', {
        command: 'sadd',
        set: 'customers:all',
        member: customerId,
      });
      console.log('✅ Adding customer to customers list:', customerId);
    }

    // Log when checking business list
    if (command.toLowerCase() === 'smembers' && args.length >= 1 && args[0] === 'businesses:all') {
      console.log('🔍 [API SERVER] Checking businesses:all list...');
    }

    // Execute command
    let result;
    const startTime = Date.now();
    try {
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
      
      const duration = Date.now() - startTime;
      logger.redis.debug(`Redis command ${command} completed`, {
        command,
        key: args[0],
        duration: `${duration}ms`,
        success: true,
        resultType: typeof result,
        resultLength: Array.isArray(result) ? result.length : undefined,
      });
      
      // Log SADD result (number of members added)
      if (command.toLowerCase() === 'sadd' && args.length >= 2) {
        logger.redis.info(`SADD result: ${result} member(s) added to ${args[0]}`, {
          command: 'sadd',
          set: args[0],
          member: args[1],
          result: result, // Should be 1 if new member added, 0 if already exists
          success: result >= 0,
        });
      }
      
      console.log(`✅ [API SERVER] Redis command ${command} completed successfully`);
      
      // Log result for smembers on businesses:all
      if (command.toLowerCase() === 'smembers' && args.length >= 1 && args[0] === 'businesses:all') {
        const count = Array.isArray(result) ? result.length : 0;
        logger.redis.info(`SMEMBERS businesses:all - found ${count} business IDs`, {
          command: 'smembers',
          set: 'businesses:all',
          count,
          businessIds: Array.isArray(result) ? result.slice(0, 10) : [], // Log first 10 IDs
        });
        console.log(`📋 [API SERVER] businesses:all contains ${count} business IDs:`, Array.isArray(result) ? result.slice(0, 5) : result);
      }
    } catch (execError: any) {
      const duration = Date.now() - startTime;
      logger.redis.error(`Redis command ${command} execution failed`, execError, {
        command,
        key: args[0],
        argsCount: args.length,
        duration: `${duration}ms`,
      });
      throw execError; // Re-throw to be caught by outer catch
    }
    
    res.json({ data: result });
  } catch (error: any) {
    logger.redis.error('Redis proxy error', error, {
      command,
      key: req.body?.args?.[0],
      argsCount: req.body?.args?.length || 0,
    });
    logger.error('Redis API endpoint error', error, {
      command,
      path: req.path,
      method: req.method,
    });
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












