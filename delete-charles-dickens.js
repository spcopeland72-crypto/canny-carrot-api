// Delete Charles Dickens business from Redis
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

const BUSINESS_ID = 'business_1767612093266_kkngqrfeo';
const EMAIL = 'spcopeland72@gmail.com';
const EMAIL_LOWER = EMAIL.toLowerCase();

async function deleteBusiness() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    console.log('🗑️  Deleting Charles Dickens business...\n');
    
    // Delete business record
    const businessKey = `business:${BUSINESS_ID}`;
    const del1 = await redis.del(businessKey);
    console.log(`1. Deleted business record: ${businessKey} (${del1} key(s))`);
    
    // Delete email index (if exists)
    const emailIndexKey = `business:email:${EMAIL_LOWER}`;
    const del2 = await redis.del(emailIndexKey);
    console.log(`2. Deleted email index: ${emailIndexKey} (${del2} key(s))`);
    
    // Delete auth credentials (if exists)
    const authKey = `business:auth:${EMAIL_LOWER}`;
    const del3 = await redis.del(authKey);
    console.log(`3. Deleted auth credentials: ${authKey} (${del3} key(s))`);
    
    // Delete business auth index (if exists)
    const businessAuthIndexKey = `business:${BUSINESS_ID}:auth:${EMAIL_LOWER}`;
    const del4 = await redis.del(businessAuthIndexKey);
    console.log(`4. Deleted business auth index: ${businessAuthIndexKey} (${del4} key(s))`);
    
    // Remove from businesses:all set
    const rem = await redis.srem('businesses:all', BUSINESS_ID);
    console.log(`5. Removed from businesses:all set (${rem} member(s) removed)`);
    
    console.log('\n✅ Charles Dickens business deleted from Redis\n');
    
    await redis.quit();
    console.log('✅ Connection closed\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

deleteBusiness();







