/**
 * Read rewards and campaigns for The Stables from API
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

async function readStablesData() {
  try {
    await redis.connect();
    await redis.ping();
    
    // Find The Stables business ID
    const businessIds = await redis.smembers('businesses:all');
    let stablesId = null;
    
    for (const id of businessIds) {
      const businessData = await redis.get(`business:${id}`);
      if (businessData) {
        const business = JSON.parse(businessData);
        if (business.name && business.name.toLowerCase().includes('stables')) {
          stablesId = id;
          break;
        }
      }
    }
    
    if (!stablesId) {
      console.log('The Stables business not found');
      await redis.quit();
      return;
    }
    
    console.log('REWARDS:');
    console.log('='.repeat(80));
    
    const rewardIds = await redis.smembers(`business:${stablesId}:rewards`);
    const rewards = [];
    
    for (const id of rewardIds) {
      const data = await redis.get(`reward:${id}`);
      if (data) {
        rewards.push(JSON.parse(data));
      }
    }
    
    console.log(`Found ${rewards.length} rewards:`);
    rewards.forEach((r, i) => {
      console.log(`${i + 1}. ${r.name || 'Unnamed'} (ID: ${r.id || 'N/A'})`);
    });
    console.log('\nFull rewards JSON:');
    console.log(JSON.stringify(rewards, null, 2));
    
    console.log('\n\nCAMPAIGNS:');
    console.log('='.repeat(80));
    
    const campaignIds = await redis.smembers(`business:${stablesId}:campaigns`);
    const campaigns = [];
    
    for (const id of campaignIds) {
      const data = await redis.get(`campaign:${id}`);
      if (data) {
        campaigns.push(JSON.parse(data));
      }
    }
    
    console.log(`Found ${campaigns.length} campaigns:`);
    campaigns.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name || 'Unnamed'} (ID: ${c.id || 'N/A'})`);
    });
    console.log('\nFull campaigns JSON:');
    console.log(JSON.stringify(campaigns, null, 2));
    
    await redis.quit();
  } catch (error) {
    console.error('Error:', error);
    try {
      await redis.quit();
    } catch (e) {}
    process.exit(1);
  }
}

readStablesData();

