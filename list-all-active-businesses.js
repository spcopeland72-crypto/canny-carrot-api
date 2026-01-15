// List all active businesses that should appear in autocomplete
// This script lists businesses with status='active' that are in the businesses:all set

require('dotenv').config();
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

async function listAllActiveBusinesses() {
  try {
    console.log('🔍 Connecting to Redis...');
    await redis.connect();
    await redis.ping();
    console.log('✅ Connected to Redis\n');

    // Get all business IDs from businesses:all set
    console.log('📋 Step 1: Getting all business IDs from businesses:all set...');
    const businessIds = await redis.smembers('businesses:all');
    console.log(`   Found ${businessIds.length} business ID(s) in businesses:all set\n`);

    if (businessIds.length === 0) {
      console.log('⚠️ No businesses found in businesses:all set');
      console.log('   This means autocomplete will return no suggestions.');
      process.exit(0);
    }

    // Fetch each business and filter for active ones
    console.log('📋 Step 2: Fetching business details and filtering for active businesses...\n');
    const activeBusinesses = [];
    const inactiveBusinesses = [];
    const missingBusinesses = [];

    for (const businessId of businessIds) {
      try {
        const businessData = await redis.get(`business:${businessId}`);
        
        if (!businessData) {
          missingBusinesses.push(businessId);
          console.log(`   ⚠️ Business ID ${businessId}: Missing from Redis (exists in businesses:all but no business:${businessId} key)`);
          continue;
        }

        const business = JSON.parse(businessData);
        
        if (business.status === 'active') {
          activeBusinesses.push({
            id: businessId,
            name: business.name || 'N/A',
            email: business.email || 'N/A',
            category: business.category || 'N/A',
            city: business.address?.city || 'N/A',
            region: business.address?.region || 'N/A',
          });
        } else {
          inactiveBusinesses.push({
            id: businessId,
            name: business.name || 'N/A',
            status: business.status || 'N/A',
          });
        }
      } catch (error) {
        console.error(`   ❌ Error fetching business ${businessId}:`, error.message);
      }
    }

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total businesses in businesses:all set: ${businessIds.length}`);
    console.log(`✅ Active businesses: ${activeBusinesses.length}`);
    console.log(`❌ Inactive businesses: ${inactiveBusinesses.length}`);
    console.log(`⚠️ Missing businesses: ${missingBusinesses.length}`);
    console.log('='.repeat(80) + '\n');

    // List active businesses (these should appear in autocomplete)
    if (activeBusinesses.length > 0) {
      console.log('✅ ACTIVE BUSINESSES (should appear in autocomplete):\n');
      activeBusinesses.forEach((business, index) => {
        console.log(`${index + 1}. ${business.name}`);
        console.log(`   ID: ${business.id}`);
        console.log(`   Category: ${business.category}`);
        console.log(`   Location: ${business.city}, ${business.region}`);
        console.log(`   Email: ${business.email}`);
        console.log('');
      });
    } else {
      console.log('❌ No active businesses found!');
      console.log('   This is why autocomplete is not working.');
      console.log('   Active businesses must have status="active" to appear in suggestions.\n');
    }

    // List inactive businesses
    if (inactiveBusinesses.length > 0) {
      console.log('❌ INACTIVE BUSINESSES (will NOT appear in autocomplete):\n');
      inactiveBusinesses.forEach((business, index) => {
        console.log(`${index + 1}. ${business.name} (status: ${business.status})`);
        console.log(`   ID: ${business.id}`);
        console.log('');
      });
    }

    // List missing businesses
    if (missingBusinesses.length > 0) {
      console.log('⚠️ MISSING BUSINESSES (in businesses:all but no business record):\n');
      missingBusinesses.forEach((businessId, index) => {
        console.log(`${index + 1}. Business ID: ${businessId}`);
        console.log('');
      });
    }

    console.log('='.repeat(80));
    console.log('💡 TIP: Only businesses with status="active" will appear in autocomplete.');
    console.log('='.repeat(80) + '\n');

    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listAllActiveBusinesses();

