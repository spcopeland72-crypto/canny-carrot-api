// Test Redis Connection with Specific Credentials
const Redis = require('ioredis');

const username = 'canny-carrot';
const password = 'ccRewards99!';
const host = 'redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com';
const port = 15877;

const redisUrl = `redis://${username}:${password}@${host}:${port}`;

console.log('🔍 Testing Redis Connection...');
console.log('URL format:', redisUrl.replace(/:[^:@]+@/, ':****@'));

const redis = new Redis(redisUrl, {
  connectTimeout: 15000,
  commandTimeout: 10000,
  retryStrategy: () => null,
  lazyConnect: false,
  maxRetriesPerRequest: 1,
});

redis.on('connect', () => {
  console.log('📡 Connecting to Redis...');
});

redis.on('ready', async () => {
  console.log('✅ Redis connected and ready!');
  try {
    // Test PING
    const pingResult = await redis.ping();
    console.log('✅ PING:', pingResult);
    
    // Test WRITE
    const testKey = 'test:connection:' + Date.now();
    const testValue = JSON.stringify({ test: true, timestamp: new Date().toISOString() });
    await redis.set(testKey, testValue);
    console.log('✅ WRITE successful - Key:', testKey);
    
    // Test READ
    const readValue = await redis.get(testKey);
    console.log('✅ READ successful - Value matches:', readValue === testValue);
    
    // Test SADD
    const testSet = 'test:set:' + Date.now();
    const saddResult = await redis.sadd(testSet, 'member1', 'member2');
    console.log('✅ SADD successful - Added', saddResult, 'members');
    
    // Test SMEMBERS
    const members = await redis.smembers(testSet);
    console.log('✅ SMEMBERS successful - Found', members.length, 'members:', members);
    
    // Cleanup
    await redis.del(testKey);
    await redis.del(testSet);
    console.log('✅ Cleanup complete');
    
    await redis.quit();
    console.log('\n🎉 ALL TESTS PASSED! Redis connection is working perfectly!');
    console.log('   The credentials are correct.');
    console.log('   The issue must be in the API server configuration or Vercel environment variables.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error after connect:', err.message);
    process.exit(1);
  }
});

redis.on('error', (err) => {
  console.error('\n❌ Redis connection error:');
  console.error('   Message:', err.message);
  console.error('   Code:', err.code);
  console.error('   Errno:', err.errno);
  
  if (err.message.includes('ECONNREFUSED')) {
    console.error('\n💡 ECONNREFUSED usually means:');
    console.error('   - Wrong hostname/port');
    console.error('   - Database is paused/inactive');
  } else if (err.message.includes('ETIMEDOUT')) {
    console.error('\n💡 ETIMEDOUT usually means:');
    console.error('   - Firewall blocking connection');
    console.error('   - Wrong IP whitelist in Redis Cloud');
    console.error('   - Network routing issue');
  } else if (err.message.includes('NOAUTH') || err.message.includes('invalid password')) {
    console.error('\n💡 Authentication error usually means:');
    console.error('   - Wrong username');
    console.error('   - Wrong password');
    console.error('   - Username/password format incorrect in URL');
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

const username = 'canny-carrot';
const password = 'ccRewards99!';
const host = 'redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com';
const port = 15877;

const redisUrl = `redis://${username}:${password}@${host}:${port}`;

console.log('🔍 Testing Redis Connection...');
console.log('URL format:', redisUrl.replace(/:[^:@]+@/, ':****@'));

const redis = new Redis(redisUrl, {
  connectTimeout: 15000,
  commandTimeout: 10000,
  retryStrategy: () => null,
  lazyConnect: false,
  maxRetriesPerRequest: 1,
});

redis.on('connect', () => {
  console.log('📡 Connecting to Redis...');
});

redis.on('ready', async () => {
  console.log('✅ Redis connected and ready!');
  try {
    // Test PING
    const pingResult = await redis.ping();
    console.log('✅ PING:', pingResult);
    
    // Test WRITE
    const testKey = 'test:connection:' + Date.now();
    const testValue = JSON.stringify({ test: true, timestamp: new Date().toISOString() });
    await redis.set(testKey, testValue);
    console.log('✅ WRITE successful - Key:', testKey);
    
    // Test READ
    const readValue = await redis.get(testKey);
    console.log('✅ READ successful - Value matches:', readValue === testValue);
    
    // Test SADD
    const testSet = 'test:set:' + Date.now();
    const saddResult = await redis.sadd(testSet, 'member1', 'member2');
    console.log('✅ SADD successful - Added', saddResult, 'members');
    
    // Test SMEMBERS
    const members = await redis.smembers(testSet);
    console.log('✅ SMEMBERS successful - Found', members.length, 'members:', members);
    
    // Cleanup
    await redis.del(testKey);
    await redis.del(testSet);
    console.log('✅ Cleanup complete');
    
    await redis.quit();
    console.log('\n🎉 ALL TESTS PASSED! Redis connection is working perfectly!');
    console.log('   The credentials are correct.');
    console.log('   The issue must be in the API server configuration or Vercel environment variables.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error after connect:', err.message);
    process.exit(1);
  }
});

redis.on('error', (err) => {
  console.error('\n❌ Redis connection error:');
  console.error('   Message:', err.message);
  console.error('   Code:', err.code);
  console.error('   Errno:', err.errno);
  
  if (err.message.includes('ECONNREFUSED')) {
    console.error('\n💡 ECONNREFUSED usually means:');
    console.error('   - Wrong hostname/port');
    console.error('   - Database is paused/inactive');
  } else if (err.message.includes('ETIMEDOUT')) {
    console.error('\n💡 ETIMEDOUT usually means:');
    console.error('   - Firewall blocking connection');
    console.error('   - Wrong IP whitelist in Redis Cloud');
    console.error('   - Network routing issue');
  } else if (err.message.includes('NOAUTH') || err.message.includes('invalid password')) {
    console.error('\n💡 Authentication error usually means:');
    console.error('   - Wrong username');
    console.error('   - Wrong password');
    console.error('   - Username/password format incorrect in URL');
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


