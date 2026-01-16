/**
 * Comprehensive route testing script
 * Tests all API routes to see which ones work and which fail
 */

const API_URL = process.env.CANNY_CARROT_API_URL || 'https://api.cannycarrot.com';

// Define all routes to test
const routes = [
  // Root and health
  { name: 'Root', method: 'GET', path: '/', expectSuccess: true },
  { name: 'Health Check', method: 'GET', path: '/health', expectSuccess: true },
  
  // Auth routes
  { name: 'Auth Register', method: 'POST', path: '/api/v1/auth/business/register', body: { email: 'test@example.com', password: 'test123', businessId: 'test123' }, expectSuccess: false },
  { name: 'Auth Login', method: 'POST', path: '/api/v1/auth/business/login', body: { email: 'test@example.com', password: 'test123' }, expectSuccess: false },
  
  // Redis proxy (should work)
  { name: 'Redis GET', method: 'POST', path: '/api/v1/redis/get', body: { args: ['test:key'] }, expectSuccess: true },
  { name: 'Redis SET', method: 'POST', path: '/api/v1/redis/set', body: { args: ['test:key', 'test-value'] }, expectSuccess: true },
  { name: 'Redis Health', method: 'GET', path: '/api/v1/redis/health', expectSuccess: false },
  
  // Business routes (may require auth/data)
  { name: 'Businesses List', method: 'GET', path: '/api/v1/businesses', expectSuccess: false },
  { name: 'Business Get', method: 'GET', path: '/api/v1/businesses/test-id', expectSuccess: false },
  
  // Member routes
  { name: 'Members List', method: 'GET', path: '/api/v1/members', expectSuccess: false },
  
  // Campaign routes
  { name: 'Campaigns List', method: 'GET', path: '/api/v1/campaigns', expectSuccess: false },
  
  // Reward routes
  { name: 'Rewards List', method: 'GET', path: '/api/v1/rewards', expectSuccess: false },
  
  // Analytics routes
  { name: 'Analytics', method: 'GET', path: '/api/v1/analytics', expectSuccess: false },
  
  // Stamps routes
  { name: 'Stamps', method: 'GET', path: '/api/v1/stamps', expectSuccess: false },
  
  // Notifications routes
  { name: 'Notifications', method: 'GET', path: '/api/v1/notifications', expectSuccess: false },
  
  // Payments routes
  { name: 'Payments Config', method: 'GET', path: '/api/v1/payments/config', expectSuccess: false },
  
  // Integrations routes
  { name: 'Integrations', method: 'GET', path: '/api/v1/integrations', expectSuccess: false },
  
  // Personalisation routes
  { name: 'Personalisation', method: 'GET', path: '/api/v1/personalisation', expectSuccess: false },
  
  // Gamification routes
  { name: 'Gamification', method: 'GET', path: '/api/v1/gamification', expectSuccess: false },
  
  // BID routes
  { name: 'BID', method: 'GET', path: '/api/v1/bid', expectSuccess: false },
];

async function testRoute(route) {
  const url = `${API_URL}${route.path}`;
  const options = {
    method: route.method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (route.body) {
    options.body = JSON.stringify(route.body);
  }

  try {
    const response = await fetch(url, options);
    const status = response.status;
    const isSuccess = status >= 200 && status < 400;
    
    let bodyText = '';
    try {
      bodyText = await response.text();
    } catch (e) {
      bodyText = 'Could not read response body';
    }
    
    return {
      success: isSuccess,
      status,
      statusText: response.statusText,
      body: bodyText.substring(0, 200),
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      statusText: 'Network Error',
      body: '',
      error: error.message,
    };
  }
}

async function runTests() {
  console.log('\n🔍 ========================================');
  console.log('🔍 COMPREHENSIVE ROUTE TEST');
  console.log('🔍 ========================================\n');
  console.log('📍 API URL:', API_URL);
  console.log('📅 Test time:', new Date().toISOString());
  console.log('📊 Testing', routes.length, 'routes...\n\n');

  const results = {
    working: [],
    failing: [],
    errors: [],
  };

  for (const route of routes) {
    const result = await testRoute(route);
    const testResult = { ...route, ...result };
    
    if (result.success) {
      results.working.push(testResult);
      console.log(`✅ ${route.name}: ${result.status} ${result.statusText}`);
    } else if (result.error) {
      results.errors.push(testResult);
      console.log(`❌ ${route.name}: ${result.error}`);
    } else {
      results.failing.push(testResult);
      const statusMsg = result.status === 404 ? 'Not Found' : result.statusText;
      console.log(`❌ ${route.name}: ${result.status} ${statusMsg}`);
    }
  }

  console.log('\n\n📊 ========================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('📊 ========================================\n');
  console.log(`Total routes tested: ${routes.length}`);
  console.log(`✅ Working (200-399): ${results.working.length}`);
  console.log(`❌ Failing (400+): ${results.failing.length + results.errors.length}`);
  if (results.failing.filter(r => r.status === 404).length > 0) {
    console.log(`   └─ 404 Not Found: ${results.failing.filter(r => r.status === 404).length}`);
  }
  if (results.errors.length > 0) {
    console.log(`   └─ Other errors: ${results.errors.length}`);
  }
  console.log('\n\n✅ WORKING ROUTES:');
  console.log('────────────────────────────────────────────────────────────');
  for (const route of results.working) {
    console.log(`✅ ${route.method} ${route.path} - ${route.status} OK`);
  }

  if (results.failing.length > 0) {
    console.log('\n\n❌ 404 NOT FOUND ROUTES:');
    console.log('────────────────────────────────────────────────────────────');
    for (const route of results.failing.filter(r => r.status === 404)) {
      console.log(`❌ ${route.method} ${route.path} - ${route.status} Not Found`);
    }
  }

  if (results.failing.filter(r => r.status !== 404).length > 0) {
    console.log('\n\n⚠️  OTHER ERRORS (non-404):');
    console.log('────────────────────────────────────────────────────────────');
    for (const route of results.failing.filter(r => r.status !== 404)) {
      console.log(`⚠️  ${route.method} ${route.path} - ${route.status} ${route.statusText}`);
    }
  }

  if (results.errors.length > 0) {
    console.log('\n\n❌ NETWORK ERRORS:');
    console.log('────────────────────────────────────────────────────────────');
    for (const route of results.errors) {
      console.log(`❌ ${route.method} ${route.path} - ${route.error}`);
    }
  }

  // Summary by category
  const authRoutes = routes.filter(r => r.path.includes('/auth'));
  const redisRoutes = routes.filter(r => r.path.includes('/redis'));
  const authWorking = results.working.filter(r => r.path.includes('/auth')).length;
  const redisWorking = results.working.filter(r => r.path.includes('/redis')).length;
  const otherWorking = results.working.filter(r => !r.path.includes('/auth') && !r.path.includes('/redis')).length;
  const otherTotal = routes.length - authRoutes.length - redisRoutes.length;

  console.log('\n\n📋 SUMMARY BY CATEGORY:');
  console.log('────────────────────────────────────────────────────────────');
  console.log(`Auth Routes: ${authWorking}/${authRoutes.length} working`);
  console.log(`Redis Routes: ${redisWorking}/${redisRoutes.length} working`);
  console.log(`Other Routes: ${otherWorking}/${otherTotal} working`);

  console.log('\n🔍 ========================================\n');
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});







