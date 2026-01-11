// Check what businesses are actually in Redis
const Redis = require('ioredis');

const redisUrl = 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

async function checkBusinesses() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    // Check businesses:all set
    console.log('📋 Checking businesses:all set...');
    const allBusinessIds = await redis.smembers('businesses:all');
    console.log(`   Found ${allBusinessIds.length} business IDs in set`);
    
    if (allBusinessIds.length > 0) {
      console.log('   Business IDs:', allBusinessIds.slice(0, 10).join(', '));
      
      // Try to read a few business records
      console.log('\n📖 Reading business records...');
      for (const id of allBusinessIds.slice(0, 5)) {
        const key = `business:${id}`;
        const data = await redis.get(key);
        if (data) {
          const business = JSON.parse(data);
          console.log(`   ✅ ${key}: ${business.profile?.name || 'N/A'} (${business.profile?.email || 'N/A'})`);
        } else {
          console.log(`   ❌ ${key}: NOT FOUND`);
        }
      }
    } else {
      console.log('   ⚠️ No businesses in businesses:all set');
      
      // Check if there are any business:* keys at all
      console.log('\n🔍 Checking for any business:* keys...');
      const businessKeys = await redis.keys('business:*');
      console.log(`   Found ${businessKeys.length} business:* keys`);
      if (businessKeys.length > 0) {
        console.log('   Keys:', businessKeys.slice(0, 10).join(', '));
      }
    }
    
    await redis.quit();
    console.log('\n✅ Check complete');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkBusinesses();


const Redis = require('ioredis');

const redisUrl = 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

async function checkBusinesses() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    // Check businesses:all set
    console.log('📋 Checking businesses:all set...');
    const allBusinessIds = await redis.smembers('businesses:all');
    console.log(`   Found ${allBusinessIds.length} business IDs in set`);
    
    if (allBusinessIds.length > 0) {
      console.log('   Business IDs:', allBusinessIds.slice(0, 10).join(', '));
      
      // Try to read a few business records
      console.log('\n📖 Reading business records...');
      for (const id of allBusinessIds.slice(0, 5)) {
        const key = `business:${id}`;
        const data = await redis.get(key);
        if (data) {
          const business = JSON.parse(data);
          console.log(`   ✅ ${key}: ${business.profile?.name || 'N/A'} (${business.profile?.email || 'N/A'})`);
        } else {
          console.log(`   ❌ ${key}: NOT FOUND`);
        }
      }
    } else {
      console.log('   ⚠️ No businesses in businesses:all set');
      
      // Check if there are any business:* keys at all
      console.log('\n🔍 Checking for any business:* keys...');
      const businessKeys = await redis.keys('business:*');
      console.log(`   Found ${businessKeys.length} business:* keys`);
      if (businessKeys.length > 0) {
        console.log('   Keys:', businessKeys.slice(0, 10).join(', '));
      }
    }
    
    await redis.quit();
    console.log('\n✅ Check complete');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkBusinesses();


