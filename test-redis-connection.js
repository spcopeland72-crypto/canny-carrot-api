// Quick Redis Connection Test
// Run with: node test-redis-connection.js

const Redis = require('ioredis');

// Get Redis URL from environment or use placeholder
const redisUrl = process.env.REDIS_URL || 'redis://default:PASSWORD@HOST:PORT';

console.log('🔍 Testing Redis Connection...');
console.log('URL format:', redisUrl.replace(/:[^:@]+@/, ':****@')); // Hide password

const redis = new Redis(redisUrl, {
  connectTimeout: 10000,
  commandTimeout: 5000,
  retryStrategy: () => null, // Don't retry
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('📡 Connecting to Redis...');
});

redis.on('ready', () => {
  console.log('✅ Redis connection successful!');
  console.log('Status:', redis.status);
  
  // Test a simple command
  redis.ping()
    .then(result => {
      console.log('✅ PING successful:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ PING failed:', err.message);
      process.exit(1);
    });
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:');
  console.error('   Error:', err.message);
  console.error('   Code:', err.code);
  console.error('   Errno:', err.errno);
  console.error('');
  console.error('Common issues:');
  console.error('  - Wrong password');
  console.error('  - Wrong hostname/port');
  console.error('  - Database not active');
  console.error('  - Using private endpoint (need public)');
  process.exit(1);
});

// Timeout after 15 seconds
setTimeout(() => {
  console.error('❌ Connection timeout after 15 seconds');
  console.error('This usually means:');
  console.error('  - Database is not accessible');
  console.error('  - Network firewall blocking connection');
  console.error('  - Wrong endpoint URL');
  process.exit(1);
}, 15000);


// Run with: node test-redis-connection.js

const Redis = require('ioredis');

// Get Redis URL from environment or use placeholder
const redisUrl = process.env.REDIS_URL || 'redis://default:PASSWORD@HOST:PORT';

console.log('🔍 Testing Redis Connection...');
console.log('URL format:', redisUrl.replace(/:[^:@]+@/, ':****@')); // Hide password

const redis = new Redis(redisUrl, {
  connectTimeout: 10000,
  commandTimeout: 5000,
  retryStrategy: () => null, // Don't retry
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('📡 Connecting to Redis...');
});

redis.on('ready', () => {
  console.log('✅ Redis connection successful!');
  console.log('Status:', redis.status);
  
  // Test a simple command
  redis.ping()
    .then(result => {
      console.log('✅ PING successful:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ PING failed:', err.message);
      process.exit(1);
    });
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:');
  console.error('   Error:', err.message);
  console.error('   Code:', err.code);
  console.error('   Errno:', err.errno);
  console.error('');
  console.error('Common issues:');
  console.error('  - Wrong password');
  console.error('  - Wrong hostname/port');
  console.error('  - Database not active');
  console.error('  - Using private endpoint (need public)');
  process.exit(1);
});

// Timeout after 15 seconds
setTimeout(() => {
  console.error('❌ Connection timeout after 15 seconds');
  console.error('This usually means:');
  console.error('  - Database is not accessible');
  console.error('  - Network firewall blocking connection');
  console.error('  - Wrong endpoint URL');
  process.exit(1);
}, 15000);


