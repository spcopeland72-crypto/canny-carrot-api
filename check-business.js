// Quick script to check if a business registration exists in Redis
const fetch = require('node-fetch');

const API_URL = process.env.CANNY_CARROT_API_URL || 'http://localhost:3001';
const BUSINESS_NAME = "Clare's Cakes and Cookies"; // or search term

async function checkBusiness() {
  try {
    console.log('🔍 Checking for business registrations in Redis...\n');
    
    // Get all business IDs
    const smembersResponse = await fetch(`${API_URL}/api/v1/redis/smembers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: ['businesses:all']
      }),
    });
    
    const smembersData = await smembersResponse.json();
    console.log('📋 Business IDs in businesses:all:', smembersData.data);
    
    if (!smembersData.data || smembersData.data.length === 0) {
      console.log('❌ No businesses found in Redis');
      return;
    }
    
    // Check each business
    for (const businessId of smembersData.data) {
      const getResponse = await fetch(`${API_URL}/api/v1/redis/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          args: [`business:${businessId}`]
        }),
      });
      
      const businessData = await getResponse.json();
      
      if (businessData.data) {
        const business = JSON.parse(businessData.data);
        const name = business.profile?.name || business.name || 'Unknown';
        console.log(`\n🏢 Business ID: ${businessId}`);
        console.log(`   Name: ${name}`);
        console.log(`   Email: ${business.profile?.email || business.email || 'N/A'}`);
        console.log(`   Status: ${business.status || 'N/A'}`);
        
        // Check if this is the one we're looking for
        if (name.toLowerCase().includes("clare") || name.toLowerCase().includes("cakes")) {
          console.log(`\n✅ FOUND: ${name}`);
          console.log('Full record:', JSON.stringify(business, null, 2));
        }
      }
    }
  } catch (error) {
    console.error('❌ Error checking businesses:', error.message);
  }
}

checkBusiness();

