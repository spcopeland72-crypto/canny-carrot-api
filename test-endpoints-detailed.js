/**
 * Detailed endpoint testing script
 * Tests all possible endpoint paths to diagnose routing issues
 */

const API_URL = process.env.CANNY_CARROT_API_URL || 'https://api.cannycarrot.com';

async function testEndpoint(method, path, body = null) {
  const url = `${API_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const text = await response.text();
    
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: text.substring(0, 500),
      isJson: (() => {
        try {
          JSON.parse(text);
          return true;
        } catch {
          return false;
        }
      })(),
    };
  } catch (error) {
    return {
      error: error.message,
    };
  }
}

async function runTests() {
  console.log('\n🔍 ========================================');
  console.log('🔍 DETAILED ENDPOINT TESTS');
  console.log('🔍 ========================================\n');
  console.log('📍 API URL:', API_URL);
  console.log('📅 Test time:', new Date().toISOString());
  console.log('\n');

  const tests = [
    {
      name: 'Auth Register Endpoint',
      method: 'POST',
      path: '/api/v1/auth/business/register',
      body: {
        email: 'test@example.com',
        password: 'testpassword123',
        businessId: 'business_test_123',
      },
    },
    {
      name: 'Auth Login Endpoint',
      method: 'POST',
      path: '/api/v1/auth/business/login',
      body: {
        email: 'test@example.com',
        password: 'testpassword123',
      },
    },
    {
      name: 'Redis Proxy (should work)',
      method: 'POST',
      path: '/api/v1/redis/ping',
      body: { args: [] },
    },
    {
      name: 'Health Check (if exists)',
      method: 'GET',
      path: '/health',
      body: null,
    },
    {
      name: 'Root Path',
      method: 'GET',
      path: '/',
      body: null,
    },
  ];

  for (const test of tests) {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`   ${test.method} ${test.path}`);
    
    const result = await testEndpoint(test.method, test.path, test.body);
    
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    } else {
      console.log(`   📊 Status: ${result.status} ${result.statusText}`);
      
      if (result.status === 404) {
        console.log(`   ⚠️  404 - Endpoint not found`);
        if (result.body.includes('Cannot')) {
          console.log(`   📄 Response: ${result.body.split('\n')[0]}`);
        }
      } else if (result.status >= 200 && result.status < 300) {
        console.log(`   ✅ Endpoint exists and responded`);
      } else if (result.status >= 400 && result.status < 500) {
        console.log(`   ⚠️  Client error (endpoint exists but request invalid)`);
      } else {
        console.log(`   ⚠️  Server error: ${result.status}`);
      }
      
      if (result.isJson) {
        try {
          const json = JSON.parse(result.body);
          console.log(`   📦 Response (JSON):`, JSON.stringify(json, null, 2).substring(0, 200));
        } catch {}
      }
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n\n🔍 ========================================');
  console.log('🔍 TEST SUMMARY');
  console.log('🔍 ========================================\n');
  console.log('If auth endpoints return 404 but Redis proxy works:');
  console.log('  → Routes are not deployed correctly');
  console.log('  → Check Vercel deployment logs');
  console.log('  → Verify dist/routes/auth.js exists in deployment');
  console.log('  → Check if vercel-build script ran successfully');
  console.log('\n');
}

runTests().catch(console.error);








