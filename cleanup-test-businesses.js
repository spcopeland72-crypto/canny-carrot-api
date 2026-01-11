// Cleanup script: Delete all businesses with email spcopeland72@gmail.com except "Charles Dickens"
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 15000,
  commandTimeout: 10000,
});

const TARGET_EMAIL = 'spcopeland72@gmail.com';
const KEEP_NAME = 'Charles Dickens';

async function cleanupTestBusinesses() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    // Get all business IDs from businesses:all set
    console.log('📋 Step 1: Getting all business IDs from businesses:all set...');
    const businessIds = await redis.smembers('businesses:all');
    console.log(`   Found ${businessIds.length} business ID(s)\n`);
    
    if (businessIds.length === 0) {
      console.log('⚠️ No businesses found in businesses:all set');
      await redis.quit();
      return;
    }
    
    // Find businesses to delete
    console.log(`🔍 Step 2: Finding businesses with email "${TARGET_EMAIL}" (keeping "${KEEP_NAME}")...\n`);
    const businessesToDelete = [];
    const charlesDickensId = null;
    
    for (const id of businessIds) {
      const businessKey = `business:${id}`;
      const data = await redis.get(businessKey);
      
      if (data) {
        try {
          const business = JSON.parse(data);
          const email = (business.profile?.email || '').toLowerCase();
          const name = business.profile?.name || '';
          
          // Check if email matches
          if (email === TARGET_EMAIL.toLowerCase()) {
            if (name === KEEP_NAME) {
              console.log(`✅ KEEPING: ${name} (ID: ${id})`);
            } else {
              console.log(`🗑️  MARKED FOR DELETION: ${name} (ID: ${id}, Email: ${email})`);
              businessesToDelete.push({
                id,
                name,
                email,
              });
            }
          }
        } catch (parseError) {
          console.log(`⚠️ Error parsing business ${id}: ${parseError.message}`);
        }
      }
    }
    
    if (businessesToDelete.length === 0) {
      console.log('\n✅ No businesses to delete (only "Charles Dickens" found or no matches)');
      await redis.quit();
      return;
    }
    
    console.log(`\n📊 Step 3: Deleting ${businessesToDelete.length} business(es)...\n`);
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const business of businessesToDelete) {
      try {
        const businessKey = `business:${business.id}`;
        const emailLower = business.email.toLowerCase();
        const emailIndexKey = `business:email:${emailLower}`;
        const authKey = `business:auth:${emailLower}`;
        const businessAuthIndexKey = `business:${business.id}:auth:${emailLower}`;
        
        console.log(`\n🗑️  Deleting: ${business.name} (ID: ${business.id})`);
        
        // Delete business record
        const delBusiness = await redis.del(businessKey);
        console.log(`   ✅ Deleted business record: ${businessKey} (${delBusiness} key(s))`);
        
        // Remove from businesses:all set
        const remFromSet = await redis.srem('businesses:all', business.id);
        console.log(`   ✅ Removed from businesses:all set (${remFromSet} member(s) removed)`);
        
        // Delete email index
        const delEmailIndex = await redis.del(emailIndexKey);
        console.log(`   ✅ Deleted email index: ${emailIndexKey} (${delEmailIndex} key(s))`);
        
        // Delete auth credentials
        const delAuth = await redis.del(authKey);
        console.log(`   ✅ Deleted auth credentials: ${authKey} (${delAuth} key(s))`);
        
        // Delete business auth index
        const delBusinessAuthIndex = await redis.del(businessAuthIndexKey);
        console.log(`   ✅ Deleted business auth index: ${businessAuthIndexKey} (${delBusinessAuthIndex} key(s))`);
        
        deletedCount++;
        console.log(`   ✅ Successfully deleted all keys for ${business.name}`);
        
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error deleting ${business.name}: ${error.message}`);
      }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`✅ Cleanup complete!`);
    console.log(`   Deleted: ${deletedCount} business(es)`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Kept: "${KEEP_NAME}" (if found)`);
    
    // Verify final state
    console.log(`\n🔍 Step 4: Verifying final state...\n`);
    const remainingIds = await redis.smembers('businesses:all');
    console.log(`   Remaining businesses: ${remainingIds.length}`);
    
    // Check if Charles Dickens still exists
    let charlesFound = false;
    for (const id of remainingIds) {
      const businessKey = `business:${id}`;
      const data = await redis.get(businessKey);
      if (data) {
        try {
          const business = JSON.parse(data);
          if (business.profile?.name === KEEP_NAME && 
              (business.profile?.email || '').toLowerCase() === TARGET_EMAIL.toLowerCase()) {
            charlesFound = true;
            console.log(`   ✅ "${KEEP_NAME}" still exists (ID: ${id})`);
            break;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    if (!charlesFound) {
      console.log(`   ⚠️ "${KEEP_NAME}" not found in remaining businesses`);
    }
    
    await redis.quit();
    console.log('\n✅ Connection closed\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

cleanupTestBusinesses();







