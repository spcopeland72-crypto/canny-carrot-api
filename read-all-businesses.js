// Read all businesses from Redis and display them
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

async function readAllBusinesses() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    // Get all business IDs from businesses:all set
    console.log('📋 Step 1: Getting all business IDs from businesses:all set...');
    const businessIds = await redis.smembers('businesses:all');
    console.log(`   Found ${businessIds.length} business ID(s):`);
    businessIds.forEach((id, index) => {
      console.log(`   ${index + 1}. ${id}`);
    });
    console.log('');
    
    if (businessIds.length === 0) {
      console.log('⚠️ No businesses found in businesses:all set');
      await redis.quit();
      return;
    }
    
    // Read each business record
    console.log('📖 Step 2: Reading business records...\n');
    for (const id of businessIds) {
      const businessKey = `business:${id}`;
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 Business ID: ${id}`);
      console.log(`🔑 Redis Key: ${businessKey}`);
      
      const data = await redis.get(businessKey);
      if (data) {
        try {
          const business = JSON.parse(data);
          console.log(`\n✅ Data found and parsed successfully:`);
          console.log(`\n   Name: ${business.profile?.name || 'N/A'}`);
          console.log(`   Email: ${business.profile?.email || 'N/A'}`);
          console.log(`   Phone: ${business.profile?.phone || 'N/A'}`);
          console.log(`   Contact: ${business.profile?.contactName || 'N/A'}`);
          console.log(`   Address: ${business.profile?.addressLine1 || 'N/A'}`);
          console.log(`   City: ${business.profile?.city || 'N/A'}`);
          console.log(`   Postcode: ${business.profile?.postcode || 'N/A'}`);
          console.log(`   Business Type: ${business.profile?.businessType || 'N/A'}`);
          console.log(`   Status: ${business.status || 'N/A'}`);
          console.log(`   Subscription Tier: ${business.subscriptionTier || 'N/A'}`);
          console.log(`   Join Date: ${business.joinDate || 'N/A'}`);
          console.log(`\n   Full JSON:`);
          console.log(JSON.stringify(business, null, 2));
        } catch (parseError) {
          console.log(`\n❌ Error parsing JSON:`);
          console.log(`   ${parseError.message}`);
          console.log(`\n   Raw data (first 500 chars):`);
          console.log(`   ${data.substring(0, 500)}...`);
        }
      } else {
        console.log(`\n❌ No data found for key: ${businessKey}`);
        console.log(`   ⚠️ Business ID exists in businesses:all but record is missing!`);
      }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`✅ Summary: Found ${businessIds.length} business ID(s) in businesses:all set`);
    
    await redis.quit();
    console.log('✅ Connection closed\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

readAllBusinesses();


const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

async function readAllBusinesses() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    // Get all business IDs from businesses:all set
    console.log('📋 Step 1: Getting all business IDs from businesses:all set...');
    const businessIds = await redis.smembers('businesses:all');
    console.log(`   Found ${businessIds.length} business ID(s):`);
    businessIds.forEach((id, index) => {
      console.log(`   ${index + 1}. ${id}`);
    });
    console.log('');
    
    if (businessIds.length === 0) {
      console.log('⚠️ No businesses found in businesses:all set');
      await redis.quit();
      return;
    }
    
    // Read each business record
    console.log('📖 Step 2: Reading business records...\n');
    for (const id of businessIds) {
      const businessKey = `business:${id}`;
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 Business ID: ${id}`);
      console.log(`🔑 Redis Key: ${businessKey}`);
      
      const data = await redis.get(businessKey);
      if (data) {
        try {
          const business = JSON.parse(data);
          console.log(`\n✅ Data found and parsed successfully:`);
          console.log(`\n   Name: ${business.profile?.name || 'N/A'}`);
          console.log(`   Email: ${business.profile?.email || 'N/A'}`);
          console.log(`   Phone: ${business.profile?.phone || 'N/A'}`);
          console.log(`   Contact: ${business.profile?.contactName || 'N/A'}`);
          console.log(`   Address: ${business.profile?.addressLine1 || 'N/A'}`);
          console.log(`   City: ${business.profile?.city || 'N/A'}`);
          console.log(`   Postcode: ${business.profile?.postcode || 'N/A'}`);
          console.log(`   Business Type: ${business.profile?.businessType || 'N/A'}`);
          console.log(`   Status: ${business.status || 'N/A'}`);
          console.log(`   Subscription Tier: ${business.subscriptionTier || 'N/A'}`);
          console.log(`   Join Date: ${business.joinDate || 'N/A'}`);
          console.log(`\n   Full JSON:`);
          console.log(JSON.stringify(business, null, 2));
        } catch (parseError) {
          console.log(`\n❌ Error parsing JSON:`);
          console.log(`   ${parseError.message}`);
          console.log(`\n   Raw data (first 500 chars):`);
          console.log(`   ${data.substring(0, 500)}...`);
        }
      } else {
        console.log(`\n❌ No data found for key: ${businessKey}`);
        console.log(`   ⚠️ Business ID exists in businesses:all but record is missing!`);
      }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`✅ Summary: Found ${businessIds.length} business ID(s) in businesses:all set`);
    
    await redis.quit();
    console.log('✅ Connection closed\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

readAllBusinesses();


