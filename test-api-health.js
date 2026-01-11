// Test if API server is responding
const API_URL = 'https://api.cannycarrot.com';

async function testAPI() {
  try {
    console.log(`🔍 Testing API server at: ${API_URL}/health\n`);
    
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    
    console.log('✅ API Server Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.redis === 'connected') {
      console.log('\n✅ Redis is connected!');
    } else {
      console.log(`\n⚠️ Redis status: ${data.redis}`);
      if (data.redisError) {
        console.log(`   Error: ${data.redisError}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testAPI();


const API_URL = 'https://api.cannycarrot.com';

async function testAPI() {
  try {
    console.log(`🔍 Testing API server at: ${API_URL}/health\n`);
    
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    
    console.log('✅ API Server Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.redis === 'connected') {
      console.log('\n✅ Redis is connected!');
    } else {
      console.log(`\n⚠️ Redis status: ${data.redis}`);
      if (data.redisError) {
        console.log(`   Error: ${data.redisError}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testAPI();


