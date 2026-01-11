// Test Registration Flow - EXACT same as website does
// This simulates what /api/send-verification does

const API_URL = 'https://api.cannycarrot.com';

console.log('🧪 Testing Registration Flow (Website → API → Redis)');
console.log('API URL:', API_URL);
console.log('');

async function testRegistrationFlow() {
  try {
    // Step 1: Generate record ID (exactly like website does)
    const recordId = `biz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('📋 Record ID:', recordId);
    
    // Step 2: Create business record (exactly like website does)
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
    
    // Step 3: Call API server SET (exactly like website does)
    const businessKey = `business:${recordId}`;
    const setUrl = `${API_URL}/api/v1/redis/set`;
    
    console.log('\n📝 Step 1: Calling API SET...');
    console.log('   URL:', setUrl);
    console.log('   Key:', businessKey);
    
    const setResponse = await fetch(setUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [businessKey, JSON.stringify(businessRecord)]
      }),
    });
    
    console.log('   Status:', setResponse.status, setResponse.statusText);
    const setResponseText = await setResponse.text();
    console.log('   Response:', setResponseText.substring(0, 200));
    
    if (!setResponse.ok) {
      throw new Error(`SET failed: ${setResponse.status} ${setResponse.statusText} - ${setResponseText}`);
    }
    
    // Step 4: Call API server SADD (exactly like website does)
    const setKey = 'businesses:all';
    const saddUrl = `${API_URL}/api/v1/redis/sadd`;
    
    console.log('\n📝 Step 2: Calling API SADD...');
    console.log('   URL:', saddUrl);
    console.log('   Set:', setKey);
    console.log('   Member:', recordId);
    
    const saddResponse = await fetch(saddUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [setKey, recordId]
      }),
    });
    
    console.log('   Status:', saddResponse.status, saddResponse.statusText);
    const saddResponseText = await saddResponse.text();
    console.log('   Response:', saddResponseText.substring(0, 200));
    
    if (!saddResponse.ok) {
      throw new Error(`SADD failed: ${saddResponse.status} ${saddResponse.statusText} - ${saddResponseText}`);
    }
    
    // Step 5: Verify with SMEMBERS (exactly like website does)
    const smembersUrl = `${API_URL}/api/v1/redis/smembers`;
    
    console.log('\n📝 Step 3: Verifying with SMEMBERS...');
    console.log('   URL:', smembersUrl);
    console.log('   Set:', setKey);
    
    const smembersResponse = await fetch(smembersUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [setKey]
      }),
    });
    
    console.log('   Status:', smembersResponse.status, smembersResponse.statusText);
    const smembersResponseText = await smembersResponse.text();
    const smembersResult = JSON.parse(smembersResponseText);
    const businessIds = smembersResult.data || [];
    
    console.log('   Total businesses:', businessIds.length);
    console.log('   Our ID in set?', businessIds.includes(recordId));
    
    if (!businessIds.includes(recordId)) {
      throw new Error(`Record ID ${recordId} not found in businesses:all after SADD!`);
    }
    
    console.log('\n🎉 SUCCESS! Registration flow works end-to-end!');
    console.log('   Record ID:', recordId);
    console.log('   This should appear in admin app');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testRegistrationFlow();


// This simulates what /api/send-verification does

const API_URL = 'https://api.cannycarrot.com';

console.log('🧪 Testing Registration Flow (Website → API → Redis)');
console.log('API URL:', API_URL);
console.log('');

async function testRegistrationFlow() {
  try {
    // Step 1: Generate record ID (exactly like website does)
    const recordId = `biz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('📋 Record ID:', recordId);
    
    // Step 2: Create business record (exactly like website does)
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
    
    // Step 3: Call API server SET (exactly like website does)
    const businessKey = `business:${recordId}`;
    const setUrl = `${API_URL}/api/v1/redis/set`;
    
    console.log('\n📝 Step 1: Calling API SET...');
    console.log('   URL:', setUrl);
    console.log('   Key:', businessKey);
    
    const setResponse = await fetch(setUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [businessKey, JSON.stringify(businessRecord)]
      }),
    });
    
    console.log('   Status:', setResponse.status, setResponse.statusText);
    const setResponseText = await setResponse.text();
    console.log('   Response:', setResponseText.substring(0, 200));
    
    if (!setResponse.ok) {
      throw new Error(`SET failed: ${setResponse.status} ${setResponse.statusText} - ${setResponseText}`);
    }
    
    // Step 4: Call API server SADD (exactly like website does)
    const setKey = 'businesses:all';
    const saddUrl = `${API_URL}/api/v1/redis/sadd`;
    
    console.log('\n📝 Step 2: Calling API SADD...');
    console.log('   URL:', saddUrl);
    console.log('   Set:', setKey);
    console.log('   Member:', recordId);
    
    const saddResponse = await fetch(saddUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [setKey, recordId]
      }),
    });
    
    console.log('   Status:', saddResponse.status, saddResponse.statusText);
    const saddResponseText = await saddResponse.text();
    console.log('   Response:', saddResponseText.substring(0, 200));
    
    if (!saddResponse.ok) {
      throw new Error(`SADD failed: ${saddResponse.status} ${saddResponse.statusText} - ${saddResponseText}`);
    }
    
    // Step 5: Verify with SMEMBERS (exactly like website does)
    const smembersUrl = `${API_URL}/api/v1/redis/smembers`;
    
    console.log('\n📝 Step 3: Verifying with SMEMBERS...');
    console.log('   URL:', smembersUrl);
    console.log('   Set:', setKey);
    
    const smembersResponse = await fetch(smembersUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: [setKey]
      }),
    });
    
    console.log('   Status:', smembersResponse.status, smembersResponse.statusText);
    const smembersResponseText = await smembersResponse.text();
    const smembersResult = JSON.parse(smembersResponseText);
    const businessIds = smembersResult.data || [];
    
    console.log('   Total businesses:', businessIds.length);
    console.log('   Our ID in set?', businessIds.includes(recordId));
    
    if (!businessIds.includes(recordId)) {
      throw new Error(`Record ID ${recordId} not found in businesses:all after SADD!`);
    }
    
    console.log('\n🎉 SUCCESS! Registration flow works end-to-end!');
    console.log('   Record ID:', recordId);
    console.log('   This should appear in admin app');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testRegistrationFlow();


