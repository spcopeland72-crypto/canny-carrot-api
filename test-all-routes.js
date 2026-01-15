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
    const text = await response.text();
    
    const isSuccess = response.status < 400;
    const isNotFound = response.status === 404;
    
    return {
      status: response.status,
      statusText: response.statusText,
      isSuccess,
      isNotFound,
      isError: response.status >= 400,
      body: text.substring(0, 200),
    };
  } catch (error) {
    return {
      error: error.message,
      isSuccess: false,
      isNotFound: false,
      isError: true,
    };
  }
}

async function runTests() {
  console.log('\n🔍 ========================================');
  console.log('🔍 COMPREHENSIVE ROUTE TEST');
  console.log('🔍 ========================================\n');
  console.log('📍 API URL:', API_URL);
  console.log('📅 Test time:', new Date().toISOString());
  console.log(`📊 Testing ${routes.length} routes...\n`);

  const results = {
    total: routes.length,
    working: 0,
    failing: 0,
    notFound: 0,
    errors: 0,
    details: [],
  };

  for (const route of routes) {
    const result = await testRoute(route);
    
    if (result.error) {
      results.errors++;
      results.failing++;
    } else if (result.isNotFound) {
      results.notFound++;
      results.failing++;
    } else if (result.isSuccess) {
      results.working++;
    } else {
      results.failing++;
    }
    
    results.details.push({
      route,
      result,
    });
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Print results
  console.log('\n📊 ========================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('📊 ========================================\n');
  
  console.log(`Total routes tested: ${results.total}`);
  console.log(`✅ Working (200-399): ${results.working}`);
  console.log(`❌ Failing (400+): ${results.failing}`);
  console.log(`   └─ 404 Not Found: ${results.notFound}`);
  console.log(`   └─ Other errors: ${results.errors}`);
  console.log('\n');

  // Print working routes
  console.log('✅ WORKING ROUTES:');
  console.log('─'.repeat(60));
  results.details
    .filter(d => d.result.isSuccess)
    .forEach(d => {
      console.log(`✅ ${d.route.method} ${d.route.path} - ${d.result.status} ${d.result.statusText}`);
    });
  console.log('\n');

  // Print 404 routes
  console.log('❌ 404 NOT FOUND ROUTES:');
  console.log('─'.repeat(60));
  results.details
    .filter(d => d.result.isNotFound)
    .forEach(d => {
      console.log(`❌ ${d.route.method} ${d.route.path} - 404 Not Found`);
    });
  console.log('\n');

  // Print other errors
  const otherErrors = results.details.filter(d => !d.result.isNotFound && !d.result.isSuccess && !d.result.error);
  if (otherErrors.length > 0) {
    console.log('⚠️  OTHER ERRORS (non-404):');
    console.log('─'.repeat(60));
    otherErrors.forEach(d => {
      console.log(`⚠️  ${d.route.method} ${d.route.path} - ${d.result.status} ${d.result.statusText}`);
    });
    console.log('\n');
  }

  // Print network errors
  const networkErrors = results.details.filter(d => d.result.error);
  if (networkErrors.length > 0) {
    console.log('💥 NETWORK ERRORS:');
    console.log('─'.repeat(60));
    networkErrors.forEach(d => {
      console.log(`💥 ${d.route.method} ${d.route.path} - ${d.result.error}`);
    });
    console.log('\n');
  }

  // Summary by category
  console.log('📋 SUMMARY BY CATEGORY:');
  console.log('─'.repeat(60));
  const authRoutes = results.details.filter(d => d.route.path.startsWith('/api/v1/auth'));
  const redisRoutes = results.details.filter(d => d.route.path.startsWith('/api/v1/redis'));
  const otherRoutes = results.details.filter(d => !d.route.path.startsWith('/api/v1/auth') && !d.route.path.startsWith('/api/v1/redis') && !d.route.path.startsWith('/health') && d.route.path !== '/');
  
  console.log(`Auth Routes: ${authRoutes.filter(d => d.result.isSuccess).length}/${authRoutes.length} working`);
  console.log(`Redis Routes: ${redisRoutes.filter(d => d.result.isSuccess).length}/${redisRoutes.length} working`);
  console.log(`Other Routes: ${otherRoutes.filter(d => d.result.isSuccess).length}/${otherRoutes.length} working`);
  
  console.log('\n🔍 ========================================\n');
}

runTests().catch(console.error);








