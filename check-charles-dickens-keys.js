// Check what Redis keys exist for Charles Dickens business
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

const BUSINESS_ID = 'business_1767612093266_kkngqrfeo';
const EMAIL = 'spcopeland72@gmail.com';
const EMAIL_LOWER = EMAIL.toLowerCase();

async function checkKeys() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    console.log('🔍 Checking Redis keys for Charles Dickens business...\n');
    
    // Check business record
    const businessKey = `business:${BUSINESS_ID}`;
    console.log(`1. Checking business record: ${businessKey}`);
    const businessData = await redis.get(businessKey);
    if (businessData) {
      const business = JSON.parse(businessData);
      console.log(`   ✅ Exists - Name: ${business.profile?.name}, Email: ${business.profile?.email}`);
    } else {
      console.log(`   ❌ NOT FOUND`);
    }
    console.log('');
    
    // Check email index
    const emailIndexKey = `business:email:${EMAIL_LOWER}`;
    console.log(`2. Checking email index: ${emailIndexKey}`);
    const emailIndexValue = await redis.get(emailIndexKey);
    if (emailIndexValue) {
      console.log(`   ✅ Exists - Points to business ID: ${emailIndexValue}`);
      if (emailIndexValue !== BUSINESS_ID) {
        console.log(`   ⚠️ WARNING: Email index points to different business ID!`);
      }
    } else {
      console.log(`   ❌ NOT FOUND - This is why login lookup returns null`);
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
    }
    console.log('');
    
    // Check business auth index
    const businessAuthIndexKey = `business:${BUSINESS_ID}:auth:${EMAIL_LOWER}`;
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
    const inSet = await redis.sismember('businesses:all', BUSINESS_ID);
    if (inSet === 1) {
      console.log(`   ✅ Exists in businesses:all set`);
    } else {
      console.log(`   ❌ NOT in businesses:all set`);
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

checkKeys();









