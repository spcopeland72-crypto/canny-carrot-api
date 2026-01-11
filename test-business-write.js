// Test Business Write - Exact same format as registration
const Redis = require('ioredis');

const redisUrl = 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  connectTimeout: 15000,
  commandTimeout: 10000,
  retryStrategy: () => null,
  lazyConnect: false,
  maxRetriesPerRequest: 1,
});

redis.on('ready', async () => {
  console.log('✅ Redis connected');
  
  try {
    // Generate ID exactly like registration does
    const recordId = `biz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('📋 Record ID:', recordId);
    
    // Create business record exactly like registration does
    const businessRecord = {
      profile: {
        id: recordId,
        name: 'TEST BUSINESS ' + Date.now(),
        email: 'test@example.com',
        phone: '01234567890',
        contactName: 'Test Contact',
        addressLine1: '123 Test St',
        addressLine2: '',
        city: 'Test City',
        postcode: 'TE5T 1NG',
        businessType: 'Retail',
        website: 'https://test.com',
      },
      subscriptionTier: 'Bronze',
      status: 'pending',
      joinDate: new Date().toISOString(),
      rewards: [],
      campaigns: [],
      customers: {},
    };
    
    // STEP 1: Write business record (exactly like registration)
    const businessKey = `business:${recordId}`;
    console.log('\n📝 Writing business record...');
    console.log('   Key:', businessKey);
    await redis.set(businessKey, JSON.stringify(businessRecord));
    console.log('✅ Business record written');
    
    // STEP 2: Add to businesses:all set (exactly like registration)
    const setKey = 'businesses:all';
    console.log('\n📝 Adding to businesses:all set...');
    console.log('   Set:', setKey);
    console.log('   Member:', recordId);
    const saddResult = await redis.sadd(setKey, recordId);
    console.log('✅ SADD result:', saddResult);
    
    // STEP 3: Verify it's in the set
    console.log('\n🔍 Verifying in businesses:all...');
    const allBusinessIds = await redis.smembers(setKey);
    console.log('   Total businesses in set:', allBusinessIds.length);
    console.log('   Our ID in set?', allBusinessIds.includes(recordId));
    
    // STEP 4: Read it back
    console.log('\n📖 Reading business record back...');
    const readBack = await redis.get(businessKey);
    const parsed = JSON.parse(readBack);
    console.log('✅ Read successful!');
    console.log('   Name:', parsed.profile.name);
    console.log('   Email:', parsed.profile.email);
    console.log('   Status:', parsed.status);
    
    console.log('\n🎉 SUCCESS! Business write/read works perfectly!');
    console.log('   This business should now appear in admin app');
    console.log('   Record ID:', recordId);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('❌ Timeout');
  process.exit(1);
}, 20000);


const Redis = require('ioredis');

const redisUrl = 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  connectTimeout: 15000,
  commandTimeout: 10000,
  retryStrategy: () => null,
  lazyConnect: false,
  maxRetriesPerRequest: 1,
});

redis.on('ready', async () => {
  console.log('✅ Redis connected');
  
  try {
    // Generate ID exactly like registration does
    const recordId = `biz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('📋 Record ID:', recordId);
    
    // Create business record exactly like registration does
    const businessRecord = {
      profile: {
        id: recordId,
        name: 'TEST BUSINESS ' + Date.now(),
        email: 'test@example.com',
        phone: '01234567890',
        contactName: 'Test Contact',
        addressLine1: '123 Test St',
        addressLine2: '',
        city: 'Test City',
        postcode: 'TE5T 1NG',
        businessType: 'Retail',
        website: 'https://test.com',
      },
      subscriptionTier: 'Bronze',
      status: 'pending',
      joinDate: new Date().toISOString(),
      rewards: [],
      campaigns: [],
      customers: {},
    };
    
    // STEP 1: Write business record (exactly like registration)
    const businessKey = `business:${recordId}`;
    console.log('\n📝 Writing business record...');
    console.log('   Key:', businessKey);
    await redis.set(businessKey, JSON.stringify(businessRecord));
    console.log('✅ Business record written');
    
    // STEP 2: Add to businesses:all set (exactly like registration)
    const setKey = 'businesses:all';
    console.log('\n📝 Adding to businesses:all set...');
    console.log('   Set:', setKey);
    console.log('   Member:', recordId);
    const saddResult = await redis.sadd(setKey, recordId);
    console.log('✅ SADD result:', saddResult);
    
    // STEP 3: Verify it's in the set
    console.log('\n🔍 Verifying in businesses:all...');
    const allBusinessIds = await redis.smembers(setKey);
    console.log('   Total businesses in set:', allBusinessIds.length);
    console.log('   Our ID in set?', allBusinessIds.includes(recordId));
    
    // STEP 4: Read it back
    console.log('\n📖 Reading business record back...');
    const readBack = await redis.get(businessKey);
    const parsed = JSON.parse(readBack);
    console.log('✅ Read successful!');
    console.log('   Name:', parsed.profile.name);
    console.log('   Email:', parsed.profile.email);
    console.log('   Status:', parsed.status);
    
    console.log('\n🎉 SUCCESS! Business write/read works perfectly!');
    console.log('   This business should now appear in admin app');
    console.log('   Record ID:', recordId);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('❌ Timeout');
  process.exit(1);
}, 20000);


