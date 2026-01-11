#!/usr/bin/env node
/**
 * Redis Record Dumper
 * 
 * This script dumps complete records from Redis database for a given account
 * (business or customer) including all related data.
 * 
 * Usage:
 *   node scripts/dump-redis-record.js --type business --email laverickclare@hotmail.com
 *   node scripts/dump-redis-record.js --type business --id business-id-here
 *   node scripts/dump-redis-record.js --type customer --id customer-id-here
 *   node scripts/dump-redis-record.js --type business --search "The Stables"
 * 
 * Requirements:
 *   - Node.js 18+
 *   - Redis connection via API (https://api.cannycarrot.com)
 *   - Or direct Redis connection if REDIS_URL is set
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://api.cannycarrot.com';
const USE_DIRECT_REDIS = process.env.USE_DIRECT_REDIS === 'true';
const REDIS_URL = process.env.REDIS_URL;

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const type = getArg('--type') || getArg('-t');
const email = getArg('--email') || getArg('-e');
const id = getArg('--id') || getArg('-i');
const search = getArg('--search') || getArg('-s');
const outputFile = getArg('--output') || getArg('-o');

// Validate arguments
if (!type || (type !== 'business' && type !== 'customer')) {
  console.error('❌ Error: --type is required and must be "business" or "customer"');
  console.log('\nUsage:');
  console.log('  node dump-redis-record.js --type business --email laverickclare@hotmail.com');
  console.log('  node dump-redis-record.js --type business --id business-id-here');
  console.log('  node dump-redis-record.js --type business --search "The Stables"');
  process.exit(1);
}

if (!email && !id && !search) {
  console.error('❌ Error: One of --email, --id, or --search is required');
  process.exit(1);
}

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

/**
 * Execute Redis command via API
 */
async function redisCommand(command, args = []) {
  try {
    const url = `${API_BASE_URL}/api/v1/redis/${command}`;
    const response = await makeRequest(url, {
      method: 'POST',
      body: { args },
    });
    
    if (response.status !== 200) {
      throw new Error(`API error: ${response.status} - ${JSON.stringify(response.data)}`);
    }
    
    return response.data.data;
  } catch (error) {
    console.error(`❌ Error executing Redis command ${command}:`, error.message);
    throw error;
  }
}

/**
 * Get business ID from email
 */
async function getBusinessIdFromEmail(email) {
  console.log(`🔍 Looking up business ID for email: ${email}`);
  const authKey = `business:auth:${email.toLowerCase()}`;
  const businessAuthData = await redisCommand('get', [authKey]);
  
  if (!businessAuthData) {
    throw new Error(`No business found with email: ${email}`);
  }
  
  const auth = typeof businessAuthData === 'string' ? JSON.parse(businessAuthData) : businessAuthData;
  return auth.businessId;
}

/**
 * Search businesses by name
 */
async function searchBusinesses(searchTerm) {
  console.log(`🔍 Searching for businesses matching: "${searchTerm}"`);
  
  // Get all business IDs (if there's a set)
  // For now, we'll try to find by checking business:auth keys
  // This is a limitation - in production, you'd have a search index
  
  // Alternative: Try to find by slug or name pattern
  // We'll need to iterate through businesses or use a search endpoint
  
  console.log('⚠️  Direct search not implemented - please use --email or --id');
  console.log('   To find The Stables, use: --email laverickclare@hotmail.com');
  throw new Error('Search not implemented - use --email or --id instead');
}

/**
 * Get complete business record with all related data
 */
async function dumpBusinessRecord(businessId) {
  console.log(`\n📦 Dumping complete record for business: ${businessId}\n`);
  
  const record = {
    businessId,
    timestamp: new Date().toISOString(),
    business: null,
    rewards: [],
    campaigns: [],
    customers: [],
    auth: null,
  };
  
  // 1. Get business profile
  console.log('1️⃣  Fetching business profile...');
  try {
    const businessData = await redisCommand('get', [`business:${businessId}`]);
    if (businessData) {
      record.business = typeof businessData === 'string' ? JSON.parse(businessData) : businessData;
      console.log(`   ✅ Business: ${record.business.name || 'Unknown'}`);
      console.log(`   📧 Email: ${record.business.email || 'N/A'}`);
    } else {
      console.log('   ⚠️  Business profile not found');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // 2. Get business auth (to find email if we searched by ID)
  if (record.business?.email) {
    console.log('2️⃣  Fetching business auth...');
    try {
      const authData = await redisCommand('get', [`business:auth:${record.business.email.toLowerCase()}`]);
      if (authData) {
        record.auth = typeof authData === 'string' ? JSON.parse(authData) : authData;
        console.log(`   ✅ Auth record found`);
      }
    } catch (error) {
      console.log(`   ⚠️  Auth record not found or error: ${error.message}`);
    }
  }
  
  // 3. Get all rewards
  console.log('3️⃣  Fetching rewards...');
  try {
    // Check Redis set first (standard location)
    const rewardIds = await redisCommand('smembers', [`business:${businessId}:rewards`]);
    if (rewardIds && Array.isArray(rewardIds) && rewardIds.length > 0) {
      console.log(`   📋 Found ${rewardIds.length} reward IDs in Redis set`);
      for (const rewardId of rewardIds) {
        try {
          const rewardData = await redisCommand('get', [`reward:${rewardId}`]);
          if (rewardData) {
            const reward = typeof rewardData === 'string' ? JSON.parse(rewardData) : rewardData;
            record.rewards.push(reward);
            console.log(`   ✅ Reward: ${reward.name || rewardId}`);
          }
        } catch (error) {
          console.log(`   ⚠️  Error fetching reward ${rewardId}: ${error.message}`);
        }
      }
    } else {
      console.log('   ℹ️  No rewards found in Redis set');
    }
    
    // Also check embedded rewards in business profile (legacy structure)
    if (record.business && record.business.rewards) {
      const embeddedRewards = [
        ...(record.business.rewards.live || []),
        ...(record.business.rewards.draft || []),
        ...(record.business.rewards.archived || [])
      ];
      if (embeddedRewards.length > 0) {
        console.log(`   📋 Found ${embeddedRewards.length} rewards embedded in business profile`);
        record.rewards.push(...embeddedRewards);
        embeddedRewards.forEach(r => {
          console.log(`   ✅ Embedded Reward: ${r.name || r.id || 'Unknown'}`);
        });
      }
    }
    
    if (record.rewards.length === 0) {
      console.log('   ⚠️  WARNING: No rewards found in Redis or business profile');
    }
  } catch (error) {
    console.log(`   ❌ Error fetching rewards: ${error.message}`);
  }
  
  // 4. Get all campaigns
  console.log('4️⃣  Fetching campaigns...');
  try {
    const campaignIds = await redisCommand('smembers', [`business:${businessId}:campaigns`]);
    if (campaignIds && Array.isArray(campaignIds) && campaignIds.length > 0) {
      console.log(`   📋 Found ${campaignIds.length} campaign IDs`);
      for (const campaignId of campaignIds) {
        try {
          const campaignData = await redisCommand('get', [`campaign:${campaignId}`]);
          if (campaignData) {
            const campaign = typeof campaignData === 'string' ? JSON.parse(campaignData) : campaignData;
            record.campaigns.push(campaign);
            console.log(`   ✅ Campaign: ${campaign.name || campaignId}`);
          }
        } catch (error) {
          console.log(`   ⚠️  Error fetching campaign ${campaignId}: ${error.message}`);
        }
      }
    } else {
      console.log('   ℹ️  No campaigns found');
    }
  } catch (error) {
    console.log(`   ❌ Error fetching campaigns: ${error.message}`);
  }
  
  // 5. Get all customers/members
  console.log('5️⃣  Fetching customers/members...');
  try {
    const memberIds = await redisCommand('smembers', [`business:${businessId}:members`]);
    if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
      console.log(`   📋 Found ${memberIds.length} member IDs`);
      for (const memberId of memberIds.slice(0, 100)) { // Limit to first 100
        try {
          const memberData = await redisCommand('get', [`member:${memberId}`]);
          if (memberData) {
            const member = typeof memberData === 'string' ? JSON.parse(memberData) : memberData;
            record.customers.push(member);
          }
        } catch (error) {
          // Silently skip - member might not exist
        }
      }
      console.log(`   ✅ Loaded ${record.customers.length} customer records`);
    } else {
      console.log('   ℹ️  No customers/members found');
    }
  } catch (error) {
    console.log(`   ❌ Error fetching customers: ${error.message}`);
  }
  
  return record;
}

/**
 * Get complete customer record
 */
async function dumpCustomerRecord(customerId) {
  console.log(`\n📦 Dumping complete record for customer: ${customerId}\n`);
  
  const record = {
    customerId,
    timestamp: new Date().toISOString(),
    customer: null,
    stamps: {},
    redemptions: [],
  };
  
  // 1. Get customer profile
  console.log('1️⃣  Fetching customer profile...');
  try {
    const customerData = await redisCommand('get', [`member:${customerId}`]);
    if (customerData) {
      record.customer = typeof customerData === 'string' ? JSON.parse(customerData) : customerData;
      console.log(`   ✅ Customer: ${record.customer.name || record.customer.email || 'Unknown'}`);
    } else {
      console.log('   ⚠️  Customer profile not found');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // 2. Get stamps for all businesses (if customer has business associations)
  // This would require knowing which businesses the customer interacted with
  // For now, we'll just return the customer record
  
  return record;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Redis Record Dumper\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Type: ${type}`);
  console.log(`Search criteria: ${email || id || search}\n`);
  
  try {
    let record;
    
    if (type === 'business') {
      let businessId = id;
      
      if (email) {
        businessId = await getBusinessIdFromEmail(email);
        console.log(`✅ Found business ID: ${businessId}\n`);
      } else if (search) {
        // For "The Stables", we know the email
        if (search.toLowerCase().includes('stables')) {
          console.log('🔍 Detected "The Stables" - using known email: laverickclare@hotmail.com');
          businessId = await getBusinessIdFromEmail('laverickclare@hotmail.com');
          console.log(`✅ Found business ID: ${businessId}\n`);
        } else {
          await searchBusinesses(search);
        }
      }
      
      if (!businessId) {
        throw new Error('Business ID is required');
      }
      
      record = await dumpBusinessRecord(businessId);
      
    } else if (type === 'customer') {
      if (!id) {
        throw new Error('Customer ID is required (use --id)');
      }
      record = await dumpCustomerRecord(id);
    }
    
    // Output results
    console.log('\n' + '='.repeat(80));
    console.log('📄 COMPLETE RECORD DUMP');
    console.log('='.repeat(80) + '\n');
    
    const output = JSON.stringify(record, null, 2);
    
    if (outputFile) {
      const fs = require('fs');
      fs.writeFileSync(outputFile, output, 'utf8');
      console.log(`✅ Record dumped to: ${outputFile}`);
    } else {
      console.log(output);
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    if (type === 'business') {
      console.log(`Business: ${record.business?.name || 'N/A'}`);
      console.log(`Email: ${record.business?.email || 'N/A'}`);
      console.log(`Rewards: ${record.rewards.length}`);
      console.log(`Campaigns: ${record.campaigns.length}`);
      console.log(`Customers: ${record.customers.length}`);
    } else {
      console.log(`Customer: ${record.customer?.name || record.customer?.email || 'N/A'}`);
    }
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
main();

