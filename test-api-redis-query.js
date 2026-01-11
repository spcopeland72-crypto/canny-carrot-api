// Test querying Redis via the API server
const API_URL = 'https://api.cannycarrot.com';

async function checkBusinessesViaAPI() {
  try {
    console.log('🔍 Checking businesses via API server...\n');
    
    // Get all business IDs from businesses:all set
    console.log('📋 Step 1: Getting businesses:all set...');
    const smembersResponse = await fetch(`${API_URL}/api/v1/redis/smembers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: ['businesses:all']
      }),
    });
    
    if (!smembersResponse.ok) {
      throw new Error(`SMEMBERS failed: ${smembersResponse.status} ${smembersResponse.statusText}`);
    }
    
    const smembersData = await smembersResponse.json();
    const businessIds = smembersData.data || [];
    
    console.log(`   ✅ Found ${businessIds.length} business IDs`);
    if (businessIds.length > 0) {
      console.log('   IDs:', businessIds.join(', '));
      
      // Try to read one business record
      if (businessIds.length > 0) {
        const testId = businessIds[0];
        const businessKey = `business:${testId}`;
        
        console.log(`\n📖 Step 2: Reading business record for ${testId}...`);
        const getResponse = await fetch(`${API_URL}/api/v1/redis/get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            args: [businessKey]
          }),
        });
        
        if (getResponse.ok) {
          const getData = await getResponse.json();
          const business = JSON.parse(getData.data);
          console.log(`   ✅ Business found:`);
          console.log(`      Name: ${business.profile?.name || 'N/A'}`);
          console.log(`      Email: ${business.profile?.email || 'N/A'}`);
          console.log(`      Status: ${business.status || 'N/A'}`);
        } else {
          console.log(`   ❌ Failed to read business record`);
        }
      }
    } else {
      console.log('   ⚠️ No businesses found in Redis');
    }
    
    console.log('\n✅ Check complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkBusinessesViaAPI();


const API_URL = 'https://api.cannycarrot.com';

async function checkBusinessesViaAPI() {
  try {
    console.log('🔍 Checking businesses via API server...\n');
    
    // Get all business IDs from businesses:all set
    console.log('📋 Step 1: Getting businesses:all set...');
    const smembersResponse = await fetch(`${API_URL}/api/v1/redis/smembers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: ['businesses:all']
      }),
    });
    
    if (!smembersResponse.ok) {
      throw new Error(`SMEMBERS failed: ${smembersResponse.status} ${smembersResponse.statusText}`);
    }
    
    const smembersData = await smembersResponse.json();
    const businessIds = smembersData.data || [];
    
    console.log(`   ✅ Found ${businessIds.length} business IDs`);
    if (businessIds.length > 0) {
      console.log('   IDs:', businessIds.join(', '));
      
      // Try to read one business record
      if (businessIds.length > 0) {
        const testId = businessIds[0];
        const businessKey = `business:${testId}`;
        
        console.log(`\n📖 Step 2: Reading business record for ${testId}...`);
        const getResponse = await fetch(`${API_URL}/api/v1/redis/get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            args: [businessKey]
          }),
        });
        
        if (getResponse.ok) {
          const getData = await getResponse.json();
          const business = JSON.parse(getData.data);
          console.log(`   ✅ Business found:`);
          console.log(`      Name: ${business.profile?.name || 'N/A'}`);
          console.log(`      Email: ${business.profile?.email || 'N/A'}`);
          console.log(`      Status: ${business.status || 'N/A'}`);
        } else {
          console.log(`   ❌ Failed to read business record`);
        }
      }
    } else {
      console.log('   ⚠️ No businesses found in Redis');
    }
    
    console.log('\n✅ Check complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkBusinessesViaAPI();


