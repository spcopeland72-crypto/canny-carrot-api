// Delete business by email (finds latest business with that email)
const Redis = require('ioredis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

const EMAIL = 'spcopeland72@gmail.com';
const EMAIL_LOWER = EMAIL.toLowerCase();

async function deleteBusinessByEmail() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    // Get business ID from email index
    const emailIndexKey = `business:email:${EMAIL_LOWER}`;
    const businessId = await redis.get(emailIndexKey);
    
    if (!businessId) {
      console.log(`⚠️  No business found with email: ${EMAIL}`);
      await redis.quit();
      return;
    }
    
    console.log(`🗑️  Found business ID: ${businessId}\n`);
    console.log('🗑️  Deleting business...\n');
    
    // Delete business record
    const businessKey = `business:${businessId}`;
    const del1 = await redis.del(businessKey);
    console.log(`1. Deleted business record: ${businessKey} (${del1} key(s))`);
    
    // Delete email index
    const del2 = await redis.del(emailIndexKey);
    console.log(`2. Deleted email index: ${emailIndexKey} (${del2} key(s))`);
    
    // Delete auth credentials (if exists)
    const authKey = `business:auth:${EMAIL_LOWER}`;
    const del3 = await redis.del(authKey);
    console.log(`3. Deleted auth credentials: ${authKey} (${del3} key(s))`);
    
    // Delete business auth index (if exists)
    const businessAuthIndexKey = `business:${businessId}:auth:${EMAIL_LOWER}`;
    const del4 = await redis.del(businessAuthIndexKey);
    console.log(`4. Deleted business auth index: ${businessAuthIndexKey} (${del4} key(s))`);
    
    // Remove from businesses:all set
    const rem = await redis.srem('businesses:all', businessId);
    console.log(`5. Removed from businesses:all set (${rem} member(s) removed)`);
    
    console.log('\n✅ Business deleted from Redis\n');
    
    await redis.quit();
    console.log('✅ Connection closed\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

deleteBusinessByEmail();








