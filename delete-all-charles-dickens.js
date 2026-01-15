// Delete all Charles Dickens businesses from Redis
const Redis = require('ioredis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

const BUSINESS_NAME = 'Charles Dickens';

async function deleteAllCharlesDickens() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    // Get all business IDs
    const businessIds = await redis.smembers('businesses:all');
    console.log(`📋 Found ${businessIds.length} businesses in total\n`);
    
    const charlesDickensBusinesses = [];
    
    // Check each business
    for (const businessId of businessIds) {
      const businessKey = `business:${businessId}`;
      const businessData = await redis.get(businessKey);
      
      if (businessData) {
        try {
          const business = JSON.parse(businessData);
          const businessName = business.profile?.name || business.name;
          
          if (businessName && businessName.toLowerCase().includes('charles dickens')) {
            charlesDickensBusinesses.push({
              id: businessId,
              name: businessName,
              email: business.profile?.email || business.email,
            });
          }
        } catch (e) {
          // Skip if can't parse
        }
      }
    }
    
    console.log(`🔍 Found ${charlesDickensBusinesses.length} Charles Dickens businesses:\n`);
    charlesDickensBusinesses.forEach((b, i) => {
      console.log(`${i + 1}. ${b.name} (${b.id}) - ${b.email}`);
    });
    console.log('');
    
    if (charlesDickensBusinesses.length === 0) {
      console.log('✅ No Charles Dickens businesses found\n');
      await redis.quit();
      return;
    }
    
    // Delete each one
    for (const business of charlesDickensBusinesses) {
      console.log(`🗑️  Deleting: ${business.name} (${business.id})\n`);
      
      const emailLower = (business.email || '').toLowerCase();
      
      // Delete business record
      const businessKey = `business:${business.id}`;
      const del1 = await redis.del(businessKey);
      console.log(`  1. Deleted business record: ${businessKey} (${del1} key(s))`);
      
      // Delete email index (if exists)
      if (emailLower) {
        const emailIndexKey = `business:email:${emailLower}`;
        const del2 = await redis.del(emailIndexKey);
        console.log(`  2. Deleted email index: ${emailIndexKey} (${del2} key(s))`);
        
        // Delete auth credentials (if exists)
        const authKey = `business:auth:${emailLower}`;
        const del3 = await redis.del(authKey);
        console.log(`  3. Deleted auth credentials: ${authKey} (${del3} key(s))`);
        
        // Delete business auth index (if exists)
        const businessAuthIndexKey = `business:${business.id}:auth:${emailLower}`;
        const del4 = await redis.del(businessAuthIndexKey);
        console.log(`  4. Deleted business auth index: ${businessAuthIndexKey} (${del4} key(s))`);
      }
      
      // Remove from businesses:all set
      const rem = await redis.srem('businesses:all', business.id);
      console.log(`  5. Removed from businesses:all set (${rem} member(s) removed)\n`);
    }
    
    console.log(`✅ Deleted ${charlesDickensBusinesses.length} Charles Dickens business(es) from Redis\n`);
    
    await redis.quit();
    console.log('✅ Connection closed\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

deleteAllCharlesDickens();








