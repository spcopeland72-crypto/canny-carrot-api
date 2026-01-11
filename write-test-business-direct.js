// Write a test business record directly to Redis using API server config
const Redis = require('ioredis');

// Use the same Redis URL as the API server
const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

async function writeTestBusiness() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    // Create test business record matching the registration structure
    const recordId = `biz_${Date.now()}_test`;
    const businessRecord = {
      profile: {
        id: recordId,
        name: "Clare's Cakes and Cookies",
        email: "clare@cakesandcookies.co.uk",
        phone: "01642 123456",
        contactName: "Clare Smith",
        addressLine1: "123 High Street",
        addressLine2: "",
        city: "Middlesbrough",
        postcode: "TS1 1AB",
        businessType: "Café & Bakery",
        website: "https://cakesandcookies.co.uk",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      subscriptionTier: 'Bronze',
      status: 'pending',
      joinDate: new Date().toISOString(),
      rewards: [],
      campaigns: [],
      customers: {},
    };
    
    const businessKey = `business:${recordId}`;
    
    console.log('📝 Writing business record...');
    console.log(`   Key: ${businessKey}`);
    console.log(`   Name: ${businessRecord.profile.name}`);
    console.log(`   Email: ${businessRecord.profile.email}`);
    
    // Step 1: Write business record
    await redis.set(businessKey, JSON.stringify(businessRecord));
    console.log('✅ Business record written to Redis');
    
    // Step 2: Add to businesses:all set
    const addResult = await redis.sadd('businesses:all', recordId);
    console.log(`✅ Added to businesses:all set (${addResult} new member(s))`);
    
    // Step 3: Verify it was added
    const businessIds = await redis.smembers('businesses:all');
    console.log(`✅ Verified: ${businessIds.length} business(es) in businesses:all set`);
    
    if (businessIds.includes(recordId)) {
      console.log(`✅ Business ID ${recordId} found in businesses:all set`);
    } else {
      console.log(`❌ ERROR: Business ID ${recordId} NOT found in businesses:all set`);
    }
    
    // Step 4: Read it back to verify
    const readBack = await redis.get(businessKey);
    if (readBack) {
      const parsed = JSON.parse(readBack);
      console.log(`✅ Read back successful: ${parsed.profile.name}`);
    } else {
      console.log(`❌ ERROR: Could not read back business record`);
    }
    
    console.log(`\n✅ Test business written successfully!`);
    console.log(`   Business ID: ${recordId}`);
    console.log(`   Redis Key: ${businessKey}`);
    console.log(`   Check admin console - it should now show "Clare's Cakes and Cookies"`);
    
    await redis.quit();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

writeTestBusiness();


const Redis = require('ioredis');

// Use the same Redis URL as the API server
const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

async function writeTestBusiness() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    // Create test business record matching the registration structure
    const recordId = `biz_${Date.now()}_test`;
    const businessRecord = {
      profile: {
        id: recordId,
        name: "Clare's Cakes and Cookies",
        email: "clare@cakesandcookies.co.uk",
        phone: "01642 123456",
        contactName: "Clare Smith",
        addressLine1: "123 High Street",
        addressLine2: "",
        city: "Middlesbrough",
        postcode: "TS1 1AB",
        businessType: "Café & Bakery",
        website: "https://cakesandcookies.co.uk",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      subscriptionTier: 'Bronze',
      status: 'pending',
      joinDate: new Date().toISOString(),
      rewards: [],
      campaigns: [],
      customers: {},
    };
    
    const businessKey = `business:${recordId}`;
    
    console.log('📝 Writing business record...');
    console.log(`   Key: ${businessKey}`);
    console.log(`   Name: ${businessRecord.profile.name}`);
    console.log(`   Email: ${businessRecord.profile.email}`);
    
    // Step 1: Write business record
    await redis.set(businessKey, JSON.stringify(businessRecord));
    console.log('✅ Business record written to Redis');
    
    // Step 2: Add to businesses:all set
    const addResult = await redis.sadd('businesses:all', recordId);
    console.log(`✅ Added to businesses:all set (${addResult} new member(s))`);
    
    // Step 3: Verify it was added
    const businessIds = await redis.smembers('businesses:all');
    console.log(`✅ Verified: ${businessIds.length} business(es) in businesses:all set`);
    
    if (businessIds.includes(recordId)) {
      console.log(`✅ Business ID ${recordId} found in businesses:all set`);
    } else {
      console.log(`❌ ERROR: Business ID ${recordId} NOT found in businesses:all set`);
    }
    
    // Step 4: Read it back to verify
    const readBack = await redis.get(businessKey);
    if (readBack) {
      const parsed = JSON.parse(readBack);
      console.log(`✅ Read back successful: ${parsed.profile.name}`);
    } else {
      console.log(`❌ ERROR: Could not read back business record`);
    }
    
    console.log(`\n✅ Test business written successfully!`);
    console.log(`   Business ID: ${recordId}`);
    console.log(`   Redis Key: ${businessKey}`);
    console.log(`   Check admin console - it should now show "Clare's Cakes and Cookies"`);
    
    await redis.quit();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

writeTestBusiness();


