// Direct Redis Connection Test
const Redis = require('ioredis');

// Test with the actual credentials format
const redisUrl = 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

console.log('🔍 Testing Redis Connection...');
console.log('Using URL format:', redisUrl.replace(/:[^:@]+@/, ':****@')); // Hide password

const redis = new Redis(redisUrl, {
  connectTimeout: 15000, // 15 seconds
  commandTimeout: 10000, // 10 seconds
  retryStrategy: () => null, // Don't retry - fail fast
  lazyConnect: false,
  maxRetriesPerRequest: 1,
});

redis.on('connect', () => {
  console.log('📡 Connecting to Redis...');
});

redis.on('ready', async () => {
  console.log('✅ Redis connection successful!');
  console.log('Status:', redis.status);
  
  try {
    // Test WRITE
    console.log('\n🧪 Testing WRITE...');
    const testKey = 'test:write:' + Date.now();
    const testValue = JSON.stringify({ test: true, timestamp: new Date().toISOString() });
    
    await redis.set(testKey, testValue);
    console.log('✅ WRITE successful!');
    console.log('   Key:', testKey);
    
    // Test READ
    console.log('\n🧪 Testing READ...');
    const readValue = await redis.get(testKey);
    console.log('✅ READ successful!');
    console.log('   Value:', readValue);
    
    // Verify it matches
    if (readValue === testValue) {
      console.log('✅ Data integrity verified - write and read match!');
    } else {
      console.log('❌ Data mismatch!');
    }
    
    // Clean up
    await redis.del(testKey);
    console.log('✅ Test key deleted');
    
    console.log('\n🎉 SUCCESS! Redis write/read is working!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Command failed:', err.message);
    process.exit(1);
  }
});

redis.on('error', (err) => {
  console.error('\n❌ Redis connection error:');
  console.error('   Message:', err.message);
  console.error('   Code:', err.code);
  console.error('   Errno:', err.errno);
  console.error('');
  console.error('Common issues:');
  console.error('  - Wrong username/password');
  console.error('  - Wrong hostname/port');
  console.error('  - Database not active');
  console.error('  - Network firewall blocking');
  process.exit(1);
});

// Timeout after 20 seconds
setTimeout(() => {
  console.error('\n❌ Connection timeout after 20 seconds');
  console.error('This usually means:');
  console.error('  - Database is not accessible from this network');
  console.error('  - Network firewall blocking connection');
  console.error('  - Wrong endpoint URL');
  console.error('  - Database is paused/inactive');
  process.exit(1);
}, 20000);

const Redis = require('ioredis');

// Test with the actual credentials format
const redisUrl = 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

console.log('🔍 Testing Redis Connection...');
console.log('Using URL format:', redisUrl.replace(/:[^:@]+@/, ':****@')); // Hide password

const redis = new Redis(redisUrl, {
  connectTimeout: 15000, // 15 seconds
  commandTimeout: 10000, // 10 seconds
  retryStrategy: () => null, // Don't retry - fail fast
  lazyConnect: false,
  maxRetriesPerRequest: 1,
});

redis.on('connect', () => {
  console.log('📡 Connecting to Redis...');
});

redis.on('ready', async () => {
  console.log('✅ Redis connection successful!');
  console.log('Status:', redis.status);
  
  try {
    // Test WRITE
    console.log('\n🧪 Testing WRITE...');
    const testKey = 'test:write:' + Date.now();
    const testValue = JSON.stringify({ test: true, timestamp: new Date().toISOString() });
    
    await redis.set(testKey, testValue);
    console.log('✅ WRITE successful!');
    console.log('   Key:', testKey);
    
    // Test READ
    console.log('\n🧪 Testing READ...');
    const readValue = await redis.get(testKey);
    console.log('✅ READ successful!');
    console.log('   Value:', readValue);
    
    // Verify it matches
    if (readValue === testValue) {
      console.log('✅ Data integrity verified - write and read match!');
    } else {
      console.log('❌ Data mismatch!');
    }
    
    // Clean up
    await redis.del(testKey);
    console.log('✅ Test key deleted');
    
    console.log('\n🎉 SUCCESS! Redis write/read is working!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Command failed:', err.message);
    process.exit(1);
  }
});

redis.on('error', (err) => {
  console.error('\n❌ Redis connection error:');
  console.error('   Message:', err.message);
  console.error('   Code:', err.code);
  console.error('   Errno:', err.errno);
  console.error('');
  console.error('Common issues:');
  console.error('  - Wrong username/password');
  console.error('  - Wrong hostname/port');
  console.error('  - Database not active');
  console.error('  - Network firewall blocking');
  process.exit(1);
});

// Timeout after 20 seconds
setTimeout(() => {
  console.error('\n❌ Connection timeout after 20 seconds');
  console.error('This usually means:');
  console.error('  - Database is not accessible from this network');
  console.error('  - Network firewall blocking connection');
  console.error('  - Wrong endpoint URL');
  console.error('  - Database is paused/inactive');
  process.exit(1);
}, 20000);



