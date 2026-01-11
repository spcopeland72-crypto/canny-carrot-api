// Search for Clare's Cakes and Cookies in Redis
const API_URL = 'https://api.cannycarrot.com';

async function searchForClares() {
  try {
    console.log('🔍 Searching for Clare\'s Cakes and Cookies...\n');
    
    // Get all business IDs
    const smembersResponse = await fetch(`${API_URL}/api/v1/redis/smembers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: ['businesses:all']
      }),
    });
    
    if (!smembersResponse.ok) {
      throw new Error(`SMEMBERS failed: ${smembersResponse.status}`);
    }
    
    const smembersData = await smembersResponse.json();
    const businessIds = smembersData.data || [];
    
    console.log(`📋 Found ${businessIds.length} business IDs in total\n`);
    
    // Search through all businesses for "Clare" or "Cakes"
    let found = false;
    for (const id of businessIds) {
      const businessKey = `business:${id}`;
      
      const getResponse = await fetch(`${API_URL}/api/v1/redis/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          args: [businessKey]
        }),
      });
      
      if (getResponse.ok) {
        const getData = await getResponse.json();
        if (getData.data) {
          const business = JSON.parse(getData.data);
          const name = business.profile?.name || '';
          
          if (name.toLowerCase().includes('clare') || name.toLowerCase().includes('cakes')) {
            console.log(`✅ FOUND: ${businessKey}`);
            console.log(`   Name: ${name}`);
            console.log(`   Email: ${business.profile?.email || 'N/A'}`);
            console.log(`   Status: ${business.status || 'N/A'}`);
            console.log(`   Full record:`, JSON.stringify(business, null, 2));
            found = true;
          }
        }
      }
    }
    
    if (!found) {
      console.log('❌ No businesses found with "Clare" or "Cakes" in the name');
      console.log('\nThis confirms that website registrations are NOT being written to Redis.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

searchForClares();


const API_URL = 'https://api.cannycarrot.com';

async function searchForClares() {
  try {
    console.log('🔍 Searching for Clare\'s Cakes and Cookies...\n');
    
    // Get all business IDs
    const smembersResponse = await fetch(`${API_URL}/api/v1/redis/smembers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: ['businesses:all']
      }),
    });
    
    if (!smembersResponse.ok) {
      throw new Error(`SMEMBERS failed: ${smembersResponse.status}`);
    }
    
    const smembersData = await smembersResponse.json();
    const businessIds = smembersData.data || [];
    
    console.log(`📋 Found ${businessIds.length} business IDs in total\n`);
    
    // Search through all businesses for "Clare" or "Cakes"
    let found = false;
    for (const id of businessIds) {
      const businessKey = `business:${id}`;
      
      const getResponse = await fetch(`${API_URL}/api/v1/redis/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          args: [businessKey]
        }),
      });
      
      if (getResponse.ok) {
        const getData = await getResponse.json();
        if (getData.data) {
          const business = JSON.parse(getData.data);
          const name = business.profile?.name || '';
          
          if (name.toLowerCase().includes('clare') || name.toLowerCase().includes('cakes')) {
            console.log(`✅ FOUND: ${businessKey}`);
            console.log(`   Name: ${name}`);
            console.log(`   Email: ${business.profile?.email || 'N/A'}`);
            console.log(`   Status: ${business.status || 'N/A'}`);
            console.log(`   Full record:`, JSON.stringify(business, null, 2));
            found = true;
          }
        }
      }
    }
    
    if (!found) {
      console.log('❌ No businesses found with "Clare" or "Cakes" in the name');
      console.log('\nThis confirms that website registrations are NOT being written to Redis.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

searchForClares();


