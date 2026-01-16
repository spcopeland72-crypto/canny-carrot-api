// Check the newly registered business by email
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

const EMAIL = 'spcopeland72@gmail.com';
const EMAIL_LOWER = EMAIL.toLowerCase();

async function checkRegistration() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    console.log('🔍 Checking newly registered business...\n');
    
    // Check email index first to get business ID
    const emailIndexKey = `business:email:${EMAIL_LOWER}`;
    console.log(`1. Checking email index: ${emailIndexKey}`);
    const businessId = await redis.get(emailIndexKey);
    if (businessId) {
      console.log(`   ✅ Email index exists - Business ID: ${businessId}\n`);
      
      // Check business record
      const businessKey = `business:${businessId}`;
      console.log(`2. Checking business record: ${businessKey}`);
      const businessData = await redis.get(businessKey);
      if (businessData) {
        const business = JSON.parse(businessData);
        console.log(`   ✅ Exists - Name: ${business.profile?.name}, Email: ${business.profile?.email}`);
      } else {
        console.log(`   ❌ NOT FOUND`);
      }
      console.log('');
      
      // Check auth credentials
      const authKey = `business:auth:${EMAIL_LOWER}`;
      console.log(`3. Checking auth credentials: ${authKey}`);
      const authData = await redis.get(authKey);
      if (authData) {
        const auth = JSON.parse(authData);
        console.log(`   ✅ Exists - Business ID: ${auth.businessId}, Has password hash: ${!!auth.passwordHash}`);
        console.log(`   Created at: ${auth.createdAt || 'unknown'}`);
      } else {
        console.log(`   ❌ NOT FOUND - No password hash exists for this email`);
        console.log(`   ⚠️ This means login will fail - auth credentials were not created`);
      }
      console.log('');
      
      // Check business auth index
      const businessAuthIndexKey = `business:${businessId}:auth:${EMAIL_LOWER}`;
      console.log(`4. Checking business auth index: ${businessAuthIndexKey}`);
      const businessAuthIndexValue = await redis.get(businessAuthIndexKey);
      if (businessAuthIndexValue) {
        console.log(`   ✅ Exists - Email: ${businessAuthIndexValue}`);
      } else {
        console.log(`   ❌ NOT FOUND`);
      }
      console.log('');
      
      // Check if in businesses:all set
      console.log(`5. Checking if in businesses:all set`);
      const inSet = await redis.sismember('businesses:all', businessId);
      if (inSet === 1) {
        console.log(`   ✅ Exists in businesses:all set`);
      } else {
        console.log(`   ❌ NOT in businesses:all set`);
      }
      
    } else {
      console.log(`   ❌ NOT FOUND - Email index doesn't exist`);
    }
    console.log('');
    
    await redis.quit();
    console.log('✅ Connection closed\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkRegistration();










