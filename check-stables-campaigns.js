/**
 * Check if "The Stables" has any campaigns in Redis
 * 
 * Run with: node check-stables-campaigns.js
 */

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

async function checkStablesCampaigns() {
  try {
    console.log('🔍 Connecting to Redis...');
    await redis.connect();
    await redis.ping();
    console.log('✅ Connected to Redis\n');

    // First, find "The Stables" business ID
    console.log('🔍 Searching for "The Stables" business...');
    
    let businessIds = [];
    try {
      const allBusinessIds = await redis.smembers('businesses:all');
      businessIds = allBusinessIds || [];
      console.log(`Found ${businessIds.length} businesses in businesses:all set\n`);
    } catch (error) {
      console.log('Could not get businesses:all, trying to scan...');
      // Fallback: scan for business:* keys
      const keys = [];
      let cursor = '0';
      do {
        const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', 'business:*', 'COUNT', '100');
        cursor = nextCursor;
        keys.push(...foundKeys);
        if (keys.length >= 1000) break;
      } while (cursor !== '0');
      
      businessIds = keys
        .map(key => key.replace('business:', ''))
        .filter(id => id.length > 0);
    }

    // Find "The Stables" business
    let stablesBusinessId = null;
    let stablesBusiness = null;

    for (const businessId of businessIds) {
      try {
        const businessData = await redis.get(`business:${businessId}`);
        if (businessData) {
          const business = JSON.parse(businessData);
          const businessName = (business.name || '').toLowerCase();
          
          if (businessName.includes('stables') || businessName.includes('stable')) {
            stablesBusinessId = businessId;
            stablesBusiness = business;
            console.log(`✅ Found "The Stables":`);
            console.log(`   ID: ${businessId}`);
            console.log(`   Name: ${business.name}`);
            console.log(`   Status: ${business.status}`);
            break;
          }
        }
      } catch (error) {
        // Skip invalid businesses
        continue;
      }
    }

    if (!stablesBusinessId) {
      console.log('❌ "The Stables" business not found in Redis');
      await client.quit();
      return;
    }

    console.log('\n🔍 Checking for campaigns...');

    // Check for campaigns using the businessCampaigns key pattern
    const campaignIds = await redis.smembers(`business:${stablesBusinessId}:campaigns`);
    
    if (!campaignIds || campaignIds.length === 0) {
      console.log('❌ No campaigns found for "The Stables"');
      console.log(`   Checked key: business:${stablesBusinessId}:campaigns`);
    } else {
      console.log(`✅ Found ${campaignIds.length} campaign(s) for "The Stables":\n`);
      
      for (const campaignId of campaignIds) {
        try {
          const campaignData = await redis.get(`campaign:${campaignId}`);
          if (campaignData) {
            const campaign = JSON.parse(campaignData);
            console.log(`📋 Campaign ID: ${campaignId}`);
            console.log(`   Name: ${campaign.name || 'N/A'}`);
            console.log(`   Status: ${campaign.status || 'N/A'}`);
            console.log(`   Start Date: ${campaign.startDate || 'N/A'}`);
            console.log(`   End Date: ${campaign.endDate || campaign.endAt || 'N/A'}`);
            console.log(`   Description: ${campaign.description || 'N/A'}`);
            console.log('');
          } else {
            console.log(`⚠️  Campaign ID ${campaignId} exists in set but data not found in Redis`);
          }
        } catch (error) {
          console.log(`❌ Error reading campaign ${campaignId}:`, error.message);
        }
      }
    }

    // Also check if there are any campaign keys directly
    console.log('\n🔍 Checking for direct campaign keys...');
    const campaignKeys = [];
    let cursor = '0';
    do {
      const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', 'campaign:*', 'COUNT', '100');
      cursor = nextCursor;
      campaignKeys.push(...foundKeys);
      if (campaignKeys.length >= 100) break;
    } while (cursor !== '0');

    const stablesCampaigns = [];
    for (const key of campaignKeys) {
      try {
        const campaignData = await redis.get(key);
        if (campaignData) {
          const campaign = JSON.parse(campaignData);
          if (campaign.businessId === stablesBusinessId) {
            stablesCampaigns.push({ key, campaign });
          }
        }
      } catch (error) {
        // Skip invalid campaigns
      }
    }

    if (stablesCampaigns.length > 0) {
      console.log(`✅ Found ${stablesCampaigns.length} additional campaign(s) by businessId:\n`);
      for (const { key, campaign } of stablesCampaigns) {
        console.log(`📋 ${key}`);
        console.log(`   Name: ${campaign.name || 'N/A'}`);
        console.log(`   Status: ${campaign.status || 'N/A'}`);
        console.log('');
      }
    }

    await redis.quit();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    await client.quit();
    process.exit(1);
  }
}

checkStablesCampaigns();

