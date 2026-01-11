/**
 * Test script to verify /api/v1/auth/business/register endpoint is accessible
 */

const API_URL = process.env.CANNY_CARROT_API_URL || 'https://api.cannycarrot.com';

async function testAuthEndpoint() {
  console.log('\n🔐 ========================================');
  console.log('🔐 TESTING AUTH ENDPOINT');
  console.log('🔐 ========================================\n');
  
  console.log('📍 API URL:', API_URL);
  console.log('📍 Endpoint: POST /api/v1/auth/business/register\n');

  // Test payload (using a test business ID that might exist)
  const testPayload = {
    email: 'test@example.com',
    password: 'testpassword123',
    businessId: 'business_test_123',
  };

  console.log('📤 Request payload:', {
    email: testPayload.email,
    password: '***hidden***',
    passwordLength: testPayload.password.length,
    businessId: testPayload.businessId,
  });
  console.log('\n');

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/business/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log('📥 Response status:', response.status, response.statusText);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('\n');

    const responseText = await response.text();
    console.log('📥 Response body (first 500 chars):', responseText.substring(0, 500));
    console.log('\n');

    if (!response.ok) {
      // Try to parse as JSON
      try {
        const errorData = JSON.parse(responseText);
        console.log('❌ Error response:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('❌ Error response (not JSON):', responseText);
      }

      if (response.status === 404) {
        console.log('\n⚠️  404 NOT FOUND - Endpoint does not exist on server');
        console.log('   This means the auth routes are not deployed or not accessible');
      } else if (response.status === 400 || response.status === 404) {
        console.log('\n✅ Endpoint EXISTS and is responding');
        console.log('   (Error is expected - business does not exist or validation failed)');
      }
    } else {
      console.log('✅ SUCCESS - Endpoint responded with 200/201');
      try {
        const data = JSON.parse(responseText);
        console.log('✅ Response data:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('✅ Response (not JSON):', responseText);
      }
    }

  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    console.error('   Stack:', error.stack);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Network error - Cannot reach API server');
    }
  }

  console.log('\n🔐 ========================================');
  console.log('🔐 TEST COMPLETE');
  console.log('🔐 ========================================\n');
}

// Also test login endpoint
async function testLoginEndpoint() {
  console.log('\n🔐 ========================================');
  console.log('🔐 TESTING LOGIN ENDPOINT');
  console.log('🔐 ========================================\n');
  
  const testPayload = {
    email: 'test@example.com',
    password: 'testpassword123',
  };

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/business/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log('📥 Response status:', response.status, response.statusText);
    const responseText = await response.text();
    console.log('📥 Response body (first 500 chars):', responseText.substring(0, 500));

    if (response.status === 404) {
      console.log('\n⚠️  404 NOT FOUND - Login endpoint does not exist');
    } else {
      console.log('\n✅ Login endpoint EXISTS and is responding');
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
  }

  console.log('\n');
}

// Run tests
(async () => {
  await testAuthEndpoint();
  await testLoginEndpoint();
})();






