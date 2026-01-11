// List all business emails from Redis
const Redis = require('ioredis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

async function listBusinessEmails() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    // Get all business IDs from businesses:all set
    console.log('📋 Getting all business IDs...');
    const businessIds = await redis.smembers('businesses:all');
    console.log(`   Found ${businessIds.length} business(es)\n`);
    
    if (businessIds.length === 0) {
      console.log('⚠️ No businesses found');
      await redis.quit();
      return;
    }
    
    // Read each business record and extract emails
    console.log('📧 COMPANY EMAILS:\n');
    console.log('='.repeat(80));
    
    const emails = [];
    
    for (const id of businessIds) {
      const businessKey = `business:${id}`;
      const data = await redis.get(businessKey);
      
      if (data) {
        try {
          const business = JSON.parse(data);
          const email = business.profile?.email || business.email;
          const name = business.profile?.name || business.name || 'N/A';
          
          if (email) {
            emails.push({ name, email, id });
            console.log(`${emails.length}. ${email}`);
            console.log(`   Company: ${name}`);
            console.log(`   ID: ${id}`);
            console.log('');
          }
        } catch (parseError) {
          console.error(`❌ Error parsing business ${id}:`, parseError.message);
        }
      }
    }
    
    console.log('='.repeat(80));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Companies: ${emails.length}`);
    console.log('\n💾 Email List:');
    emails.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.email} (${item.name})`);
    });
    
    await redis.quit();
    console.log('\n✅ Done\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

listBusinessEmails();





