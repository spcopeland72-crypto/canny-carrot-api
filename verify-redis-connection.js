// Verify the API server is actually connecting to the real Redis database
const API_URL = 'https://api.cannycarrot.com';

async function verifyRedisConnection() {
  try {
    console.log('🔍 Verifying API server Redis connection...\n');
    
    // Test 1: Health check
    console.log('📋 Step 1: Health check...');
    const healthResponse = await fetch(`${API_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('   Status:', healthData.redis);
    if (healthData.redisError) {
      console.log('   Error:', healthData.redisError);
    }
    
    // Test 2: Write a unique test key
    const testKey = `test:verify-${Date.now()}`;
    const testValue = JSON.stringify({ 
      test: true, 
      timestamp: new Date().toISOString(),
      source: 'verification-script'
    });
    
    console.log(`\n📋 Step 2: Writing test key: ${testKey}`);
    const setResponse = await fetch(`${API_URL}/api/v1/redis/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [testKey, testValue]
      }),
    });
    
    if (!setResponse.ok) {
      throw new Error(`SET failed: ${setResponse.status} ${setResponse.statusText}`);
    }
    const setData = await setResponse.json();
    console.log('   Response:', setData);
    
    // Test 3: Read it back
    console.log(`\n📋 Step 3: Reading test key back...`);
    const getResponse = await fetch(`${API_URL}/api/v1/redis/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [testKey]
      }),
    });
    
    if (!getResponse.ok) {
      throw new Error(`GET failed: ${getResponse.status} ${getResponse.statusText}`);
    }
    const getData = await getResponse.json();
    const retrievedValue = JSON.parse(getData.data);
    console.log('   Retrieved:', retrievedValue);
    
    if (retrievedValue.source === 'verification-script') {
      console.log('\n✅ SUCCESS: API server IS writing to and reading from Redis!');
      console.log('   The test key was written and read back successfully.');
    } else {
      console.log('\n⚠️ WARNING: Retrieved value does not match expected value');
    }
    
    // Clean up test key
    console.log(`\n📋 Step 4: Cleaning up test key...`);
    const delResponse = await fetch(`${API_URL}/api/v1/redis/del`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [testKey]
      }),
    });
    console.log('   Cleanup response:', delResponse.status);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

verifyRedisConnection();


const API_URL = 'https://api.cannycarrot.com';

async function verifyRedisConnection() {
  try {
    console.log('🔍 Verifying API server Redis connection...\n');
    
    // Test 1: Health check
    console.log('📋 Step 1: Health check...');
    const healthResponse = await fetch(`${API_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('   Status:', healthData.redis);
    if (healthData.redisError) {
      console.log('   Error:', healthData.redisError);
    }
    
    // Test 2: Write a unique test key
    const testKey = `test:verify-${Date.now()}`;
    const testValue = JSON.stringify({ 
      test: true, 
      timestamp: new Date().toISOString(),
      source: 'verification-script'
    });
    
    console.log(`\n📋 Step 2: Writing test key: ${testKey}`);
    const setResponse = await fetch(`${API_URL}/api/v1/redis/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [testKey, testValue]
      }),
    });
    
    if (!setResponse.ok) {
      throw new Error(`SET failed: ${setResponse.status} ${setResponse.statusText}`);
    }
    const setData = await setResponse.json();
    console.log('   Response:', setData);
    
    // Test 3: Read it back
    console.log(`\n📋 Step 3: Reading test key back...`);
    const getResponse = await fetch(`${API_URL}/api/v1/redis/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [testKey]
      }),
    });
    
    if (!getResponse.ok) {
      throw new Error(`GET failed: ${getResponse.status} ${getResponse.statusText}`);
    }
    const getData = await getResponse.json();
    const retrievedValue = JSON.parse(getData.data);
    console.log('   Retrieved:', retrievedValue);
    
    if (retrievedValue.source === 'verification-script') {
      console.log('\n✅ SUCCESS: API server IS writing to and reading from Redis!');
      console.log('   The test key was written and read back successfully.');
    } else {
      console.log('\n⚠️ WARNING: Retrieved value does not match expected value');
    }
    
    // Clean up test key
    console.log(`\n📋 Step 4: Cleaning up test key...`);
    const delResponse = await fetch(`${API_URL}/api/v1/redis/del`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [testKey]
      }),
    });
    console.log('   Cleanup response:', delResponse.status);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

verifyRedisConnection();


