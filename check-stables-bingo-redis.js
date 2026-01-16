require('dotenv').config();
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redisClient = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

async function checkStablesBingo() {
  try {
    console.log('🔍 Connecting to Redis...');
    await redisClient.connect();
    await redisClient.ping();
    console.log('✅ Connected to Redis\n');

    const searchName = "Stables bingo";
    console.log(`🔍 Searching for "${searchName}" in Redis...\n`);

    // Check rewards
    console.log('📋 Checking REWARDS...');
    const rewardKeys = await redisClient.keys('reward:*');
    console.log(`   Found ${rewardKeys.length} reward keys`);
    
    let foundInRewards = false;
    for (const key of rewardKeys) {
      const rewardData = await redisClient.get(key);
      if (rewardData) {
        const reward = JSON.parse(rewardData);
        if (reward.name && reward.name.toLowerCase().includes(searchName.toLowerCase())) {
          foundInRewards = true;
          console.log(`\n   ✅ FOUND IN REWARDS:`);
          console.log(`   Key: ${key}`);
          console.log(`   ID: ${reward.id}`);
          console.log(`   Name: ${reward.name}`);
          console.log(`   Business ID: ${reward.businessId}`);
          console.log(`   Type: ${reward.type || 'N/A'}`);
          console.log(`   IsActive: ${reward.isActive}`);
          console.log(`   Stamps Required: ${reward.stampsRequired || reward.costStamps || 'N/A'}`);
          console.log(`   Full object keys:`, Object.keys(reward));
        }
      }
    }

    if (!foundInRewards) {
      console.log(`   ❌ Not found in rewards`);
    }

    // Check campaigns
    console.log('\n📋 Checking CAMPAIGNS...');
    const campaignKeys = await redisClient.keys('campaign:*');
    console.log(`   Found ${campaignKeys.length} campaign keys`);
    
    let foundInCampaigns = false;
    for (const key of campaignKeys) {
      const campaignData = await redisClient.get(key);
      if (campaignData) {
        const campaign = JSON.parse(campaignData);
        if (campaign.name && campaign.name.toLowerCase().includes(searchName.toLowerCase())) {
          foundInCampaigns = true;
          console.log(`\n   ✅ FOUND IN CAMPAIGNS:`);
          console.log(`   Key: ${key}`);
          console.log(`   ID: ${campaign.id}`);
          console.log(`   Name: ${campaign.name}`);
          console.log(`   Business ID: ${campaign.businessId}`);
          console.log(`   Type: ${campaign.type || 'N/A'}`);
          console.log(`   Status: ${campaign.status || 'N/A'}`);
          console.log(`   Start Date: ${campaign.startDate || 'N/A'}`);
          console.log(`   End Date: ${campaign.endDate || 'N/A'}`);
          console.log(`   Description: ${campaign.description || 'N/A'}`);
          console.log(`   Conditions:`, JSON.stringify(campaign.conditions || {}, null, 2));
          console.log(`   Full object keys:`, Object.keys(campaign));
        }
      }
    }

    if (!foundInCampaigns) {
      console.log(`   ❌ Not found in campaigns`);
    }

    // Check business reward sets
    console.log('\n📋 Checking BUSINESS REWARD SETS...');
    const businessRewardSets = await redisClient.keys('business:*:rewards');
    console.log(`   Found ${businessRewardSets.length} business reward sets`);
    
    for (const setKey of businessRewardSets) {
      const rewardIds = await redisClient.smembers(setKey);
      for (const rewardId of rewardIds) {
        const rewardData = await redisClient.get(`reward:${rewardId}`);
        if (rewardData) {
          const reward = JSON.parse(rewardData);
          if (reward.name && reward.name.toLowerCase().includes(searchName.toLowerCase())) {
            console.log(`\n   ✅ FOUND IN BUSINESS REWARD SET:`);
            console.log(`   Set Key: ${setKey}`);
            console.log(`   Reward ID: ${rewardId}`);
            console.log(`   Name: ${reward.name}`);
          }
        }
      }
    }

    // Check business campaign sets
    console.log('\n📋 Checking BUSINESS CAMPAIGN SETS...');
    const businessCampaignSets = await redisClient.keys('business:*:campaigns');
    console.log(`   Found ${businessCampaignSets.length} business campaign sets`);
    
    for (const setKey of businessCampaignSets) {
      const campaignIds = await redisClient.smembers(setKey);
      for (const campaignId of campaignIds) {
        const campaignData = await redisClient.get(`campaign:${campaignId}`);
        if (campaignData) {
          const campaign = JSON.parse(campaignData);
          if (campaign.name && campaign.name.toLowerCase().includes(searchName.toLowerCase())) {
            console.log(`\n   ✅ FOUND IN BUSINESS CAMPAIGN SET:`);
            console.log(`   Set Key: ${setKey}`);
            console.log(`   Campaign ID: ${campaignId}`);
            console.log(`   Name: ${campaign.name}`);
          }
        }
      }
    }

    console.log('\n✅ Search complete\n');
    await redisClient.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    await redisClient.quit();
    process.exit(1);
  }
}

checkStablesBingo();

