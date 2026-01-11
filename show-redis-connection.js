// Show the exact Redis connection details being used
console.log('🔍 Redis Connection Details:\n');

const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

// Parse the Redis URL to show components
try {
  const url = new URL(redisUrl);
  console.log('✅ Redis URL Components:');
  console.log(`   Protocol: ${url.protocol}`);
  console.log(`   Username: ${url.username}`);
  console.log(`   Host: ${url.hostname}`);
  console.log(`   Port: ${url.port}`);
  console.log(`   Full Host: ${url.hostname}:${url.port}`);
  console.log('\n🔗 Full Connection String (masked password):');
  const maskedUrl = redisUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`   ${maskedUrl}`);
  console.log('\n📋 To verify this is production:');
  console.log('   1. Log into Redis Cloud: https://cloud.redis.io');
  console.log('   2. Go to your database');
  console.log('   3. Check the endpoint/host matches:', url.hostname);
  console.log('   4. Check the port matches:', url.port);
  console.log('   5. Check the username matches:', url.username);
  console.log('\n📖 To view data in Redis Cloud:');
  console.log('   1. Go to Redis Cloud dashboard');
  console.log('   2. Select your database');
  console.log('   3. Click "Redis Insight" or "CLI" tab');
  console.log('   4. Run: SMEMBERS businesses:all');
  console.log('   5. Run: GET business:biz_1766918682089_test');
  console.log('\n💻 Or use Redis CLI from command line:');
  console.log(`   redis-cli -h ${url.hostname} -p ${url.port} -a [YOUR_PASSWORD]`);
  console.log('   Then run:');
  console.log('   > SMEMBERS businesses:all');
  console.log('   > GET business:biz_1766918682089_test');
} catch (error) {
  console.error('❌ Error parsing Redis URL:', error.message);
  console.log('Raw URL:', redisUrl);
}


console.log('🔍 Redis Connection Details:\n');

const redisUrl = process.env.REDIS_URL || 'redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877';

// Parse the Redis URL to show components
try {
  const url = new URL(redisUrl);
  console.log('✅ Redis URL Components:');
  console.log(`   Protocol: ${url.protocol}`);
  console.log(`   Username: ${url.username}`);
  console.log(`   Host: ${url.hostname}`);
  console.log(`   Port: ${url.port}`);
  console.log(`   Full Host: ${url.hostname}:${url.port}`);
  console.log('\n🔗 Full Connection String (masked password):');
  const maskedUrl = redisUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`   ${maskedUrl}`);
  console.log('\n📋 To verify this is production:');
  console.log('   1. Log into Redis Cloud: https://cloud.redis.io');
  console.log('   2. Go to your database');
  console.log('   3. Check the endpoint/host matches:', url.hostname);
  console.log('   4. Check the port matches:', url.port);
  console.log('   5. Check the username matches:', url.username);
  console.log('\n📖 To view data in Redis Cloud:');
  console.log('   1. Go to Redis Cloud dashboard');
  console.log('   2. Select your database');
  console.log('   3. Click "Redis Insight" or "CLI" tab');
  console.log('   4. Run: SMEMBERS businesses:all');
  console.log('   5. Run: GET business:biz_1766918682089_test');
  console.log('\n💻 Or use Redis CLI from command line:');
  console.log(`   redis-cli -h ${url.hostname} -p ${url.port} -a [YOUR_PASSWORD]`);
  console.log('   Then run:');
  console.log('   > SMEMBERS businesses:all');
  console.log('   > GET business:biz_1766918682089_test');
} catch (error) {
  console.error('❌ Error parsing Redis URL:', error.message);
  console.log('Raw URL:', redisUrl);
}


