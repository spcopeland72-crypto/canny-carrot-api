/**
 * Read and print rewards and campaigns from Redis
 * Reads local store data - rewards and campaigns
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

async function readRewardsAndCampaigns() {
  try {
    console.log('🔍 Connecting to Redis...');
    await redis.connect();
    await redis.ping();
    console.log('✅ Connected to Redis\n');

    // Get all rewards
    console.log('REWARDS:');
    console.log('='.repeat(80));
    const rewardKeys = await redis.keys('reward:*');
    console.log(`Found ${rewardKeys.length} reward keys in Redis\n`);
    
    if (rewardKeys.length > 0) {
      for (const key of rewardKeys) {
        const rewardData = await redis.get(key);
        if (rewardData) {
          const reward = JSON.parse(rewardData);
          console.log(`${reward.name || 'Unnamed'} (ID: ${reward.id}, Business: ${reward.businessId || 'N/A'})`);
        }
      }
      
      // Print full data for first reward as example
      if (rewardKeys.length > 0) {
        const firstRewardData = await redis.get(rewardKeys[0]);
        if (firstRewardData) {
          const firstReward = JSON.parse(firstRewardData);
          console.log('\nFull data for first reward:');
          console.log(JSON.stringify(firstReward, null, 2));
        }
      }
    } else {
      console.log('No rewards found');
    }

    console.log('\n\nCAMPAIGNS:');
    console.log('='.repeat(80));
    const campaignKeys = await redis.keys('campaign:*');
    console.log(`Found ${campaignKeys.length} campaign keys in Redis\n`);
    
    if (campaignKeys.length > 0) {
      for (const key of campaignKeys) {
        const campaignData = await redis.get(key);
        if (campaignData) {
          const campaign = JSON.parse(campaignData);
          console.log(`${campaign.name || 'Unnamed'} (ID: ${campaign.id}, Business: ${campaign.businessId || 'N/A'})`);
        }
      }
      
      // Print full data for first campaign as example
      if (campaignKeys.length > 0) {
        const firstCampaignData = await redis.get(campaignKeys[0]);
        if (firstCampaignData) {
          const firstCampaign = JSON.parse(firstCampaignData);
          console.log('\nFull data for first campaign:');
          console.log(JSON.stringify(firstCampaign, null, 2));
        }
      }
    } else {
      console.log('No campaigns found');
    }

    await redis.quit();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    try {
      await redis.quit();
    } catch (e) {}
    process.exit(1);
  }
}

readRewardsAndCampaigns();

