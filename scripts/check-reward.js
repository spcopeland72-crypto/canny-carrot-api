// Check if a specific reward exists in Redis
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

async function checkReward(rewardName) {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    // Business ID for "The Stables"
    const businessId = 'business_1767744076082_i3d1uu42x';
    
    // Get all reward IDs for this business
    const rewardIds = await redis.smembers(`business:${businessId}:rewards`);
    console.log(`📋 Found ${rewardIds.length} reward IDs for business: ${businessId}\n`);
    
    if (rewardIds.length === 0) {
      console.log('⚠️ No rewards found in business rewards set');
      console.log('   Checking if rewards are embedded in business profile...\n');
      
      // Check business profile for embedded rewards
      const businessData = await redis.get(`business:${businessId}`);
      if (businessData) {
        const business = JSON.parse(businessData);
        if (business.rewards && Array.isArray(business.rewards)) {
          console.log(`   Found ${business.rewards.length} rewards in business profile`);
          business.rewards.forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.name || r.id || 'Unnamed'}`);
          });
        }
      }
    }
    
    // Check each reward
    let found = false;
    for (const rewardId of rewardIds) {
      const rewardData = await redis.get(`reward:${rewardId}`);
      if (rewardData) {
        const reward = JSON.parse(rewardData);
        console.log(`\n📦 Reward: ${reward.name}`);
        console.log(`   ID: ${reward.id}`);
        console.log(`   Business ID: ${reward.businessId}`);
        console.log(`   Stamps Required: ${reward.stampsRequired || reward.costStamps || 'N/A'}`);
        console.log(`   Type: ${reward.type || 'N/A'}`);
        console.log(`   Active: ${reward.isActive !== undefined ? reward.isActive : 'N/A'}`);
        console.log(`   Created: ${reward.createdAt || 'N/A'}`);
        
        if (reward.name && reward.name.toLowerCase().includes(rewardName.toLowerCase())) {
          found = true;
          console.log(`\n✅ FOUND: "${reward.name}" matches "${rewardName}"`);
        }
      }
    }
    
    if (!found && rewardIds.length > 0) {
      console.log(`\n❌ Reward "${rewardName}" not found in Redis`);
      console.log(`   Searched ${rewardIds.length} rewards`);
    } else if (rewardIds.length === 0) {
      console.log(`\n⚠️ No rewards to search - business rewards set is empty`);
    }
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const rewardName = process.argv[2] || 'Parmo';
checkReward(rewardName);



