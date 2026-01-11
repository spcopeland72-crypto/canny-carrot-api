// Test if Redis URL format is correct
const Redis = require('ioredis');

// This is the exact URL that should be in Vercel env vars
const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

console.log('Testing Redis connection...');
console.log('URL format:', redisUrl.replace(/:[^:@]+@/, ':****@'));

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null, // Don't retry - fail fast
});

redis.on('connect', () => {
  console.log('📡 Connecting to Redis...');
});

redis.on('ready', async () => {
  console.log('✅ Redis connected and ready!');
  try {
    const result = await redis.ping();
    console.log('✅ PING:', result);
    await redis.quit();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error after connect:', err.message);
    process.exit(1);
  }
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:');
  console.error('   Message:', err.message);
  console.error('   Code:', err.code);
  console.error('   Errno:', err.errno);
  
  if (err.message.includes('ECONNREFUSED')) {
    console.error('\n💡 This usually means:');
    console.error('   - Wrong hostname/port');
    console.error('   - Database is paused/inactive');
  } else if (err.message.includes('ETIMEDOUT')) {
    console.error('\n💡 This usually means:');
    console.error('   - Firewall blocking connection');
    console.error('   - Wrong IP whitelist in Redis Cloud');
    console.error('   - Network routing issue');
  } else if (err.message.includes('NOAUTH')) {
    console.error('\n💡 This usually means:');
    console.error('   - Wrong username or password');
  }
  
  process.exit(1);
});

// Try to connect
console.log('Attempting connection...');
redis.connect().catch((err) => {
  console.error('❌ Connect failed:', err.message);
  process.exit(1);
});

// Timeout
setTimeout(() => {
  console.error('\n❌ Connection timeout after 15 seconds');
  console.error('Status:', redis.status);
  process.exit(1);
}, 15000);


const Redis = require('ioredis');

// This is the exact URL that should be in Vercel env vars
const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

console.log('Testing Redis connection...');
console.log('URL format:', redisUrl.replace(/:[^:@]+@/, ':****@'));

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null, // Don't retry - fail fast
});

redis.on('connect', () => {
  console.log('📡 Connecting to Redis...');
});

redis.on('ready', async () => {
  console.log('✅ Redis connected and ready!');
  try {
    const result = await redis.ping();
    console.log('✅ PING:', result);
    await redis.quit();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error after connect:', err.message);
    process.exit(1);
  }
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:');
  console.error('   Message:', err.message);
  console.error('   Code:', err.code);
  console.error('   Errno:', err.errno);
  
  if (err.message.includes('ECONNREFUSED')) {
    console.error('\n💡 This usually means:');
    console.error('   - Wrong hostname/port');
    console.error('   - Database is paused/inactive');
  } else if (err.message.includes('ETIMEDOUT')) {
    console.error('\n💡 This usually means:');
    console.error('   - Firewall blocking connection');
    console.error('   - Wrong IP whitelist in Redis Cloud');
    console.error('   - Network routing issue');
  } else if (err.message.includes('NOAUTH')) {
    console.error('\n💡 This usually means:');
    console.error('   - Wrong username or password');
  }
  
  process.exit(1);
});

// Try to connect
console.log('Attempting connection...');
redis.connect().catch((err) => {
  console.error('❌ Connect failed:', err.message);
  process.exit(1);
});

// Timeout
setTimeout(() => {
  console.error('\n❌ Connection timeout after 15 seconds');
  console.error('Status:', redis.status);
  process.exit(1);
}, 15000);


