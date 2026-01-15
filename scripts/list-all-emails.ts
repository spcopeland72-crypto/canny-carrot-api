/**
 * List All Emails Script
 * 
 * Connects to Redis and lists all email addresses from:
 * - Business records (business:{id})
 * - Member/Customer records (member:{id})
 * 
 * Usage:
 *   npx ts-node scripts/list-all-emails.ts
 * 
 * Or compile and run:
 *   npm run build
 *   node dist/scripts/list-all-emails.js
 */

import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

interface EmailRecord {
  type: 'business' | 'member';
  id: string;
  email: string;
  name?: string;
  businessName?: string;
  contactName?: string;
}

async function listAllEmails() {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.error('❌ REDIS_URL environment variable is not set');
    console.log('💡 Please set REDIS_URL in your .env file or environment');
    process.exit(1);
  }

  console.log('📡 Connecting to Redis...');
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    commandTimeout: 30000,
    enableReadyCheck: false,
    enableOfflineQueue: false,
  });

  try {
    // Test connection
    await redis.ping();
    console.log('✅ Connected to Redis\n');

    const emails: EmailRecord[] = [];

    // Method 1: Try to use sets if they exist
    console.log('🔍 Checking for businesses:all and customers:all sets...');
    const businessIds = await redis.smembers('businesses:all');
    const customerIds = await redis.smembers('customers:all');
    
    if (businessIds.length > 0) {
      console.log(`📋 Found ${businessIds.length} business IDs in businesses:all set`);
      for (const id of businessIds) {
        try {
          const data = await redis.get(`business:${id}`);
          if (data) {
            const business = JSON.parse(data);
            const email = business?.profile?.email || business?.email;
            if (email) {
              emails.push({
                type: 'business',
                id,
                email,
                businessName: business?.profile?.name || business?.name,
                contactName: business?.profile?.contactName,
              });
            }
          }
        } catch (err) {
          console.error(`⚠️  Error reading business:${id}:`, (err as Error).message);
        }
      }
    }

    if (customerIds.length > 0) {
      console.log(`📋 Found ${customerIds.length} customer IDs in customers:all set`);
      for (const id of customerIds) {
        try {
          const data = await redis.get(`customer:${id}`);
          if (data) {
            const customer = JSON.parse(data);
            const email = customer?.profile?.email || customer?.email;
            if (email) {
              emails.push({
                type: 'member',
                id,
                email,
                name: customer?.profile?.name || customer?.name,
              });
            }
          }
        } catch (err) {
          console.error(`⚠️  Error reading customer:${id}:`, (err as Error).message);
        }
      }
    }

    // Method 2: Also scan for keys directly (in case sets don't exist)
    if (businessIds.length === 0 && customerIds.length === 0) {
      console.log('🔍 Sets not found, scanning keys directly...\n');
      
      // Scan for business keys
      console.log('📋 Scanning for business:* keys...');
      let cursor = '0';
      let businessCount = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'business:*', 'COUNT', 100);
        cursor = nextCursor;
        
        for (const key of keys) {
          // Skip sets and lists
          if (key.includes(':all') || key.includes(':members') || key.includes(':rewards')) {
            continue;
          }
          
          try {
            const data = await redis.get(key);
            if (data) {
              const business = JSON.parse(data);
              const email = business?.profile?.email || business?.email;
              if (email && !emails.find(e => e.email === email && e.type === 'business')) {
                const id = key.replace('business:', '');
                emails.push({
                  type: 'business',
                  id,
                  email,
                  businessName: business?.profile?.name || business?.name,
                  contactName: business?.profile?.contactName,
                });
                businessCount++;
              }
            }
          } catch (err) {
            // Skip non-JSON values
          }
        }
      } while (cursor !== '0');
      console.log(`✅ Found ${businessCount} businesses with emails`);

      // Scan for member keys
      console.log('📋 Scanning for member:* keys...');
      cursor = '0';
      let memberCount = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'member:*', 'COUNT', 100);
        cursor = nextCursor;
        
        for (const key of keys) {
          // Skip lookup keys and stamps
          if (key.includes(':email:') || key.includes(':phone:') || key.includes(':stamps:') || key.includes(':notifications')) {
            continue;
          }
          
          try {
            const data = await redis.get(key);
            if (data) {
              const member = JSON.parse(data);
              const email = member?.profile?.email || member?.email;
              if (email && !emails.find(e => e.email === email && e.type === 'member')) {
                const id = key.replace('member:', '');
                emails.push({
                  type: 'member',
                  id,
                  email,
                  name: member?.profile?.name || member?.name,
                });
                memberCount++;
              }
            }
          } catch (err) {
            // Skip non-JSON values
          }
        }
      } while (cursor !== '0');
      console.log(`✅ Found ${memberCount} members with emails`);
    }

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log(`📧 TOTAL EMAILS FOUND: ${emails.length}`);
    console.log('='.repeat(80) + '\n');

    // Group by type
    const businessEmails = emails.filter(e => e.type === 'business');
    const memberEmails = emails.filter(e => e.type === 'member');

    if (businessEmails.length > 0) {
      console.log(`\n🏢 BUSINESS EMAILS (${businessEmails.length}):`);
      console.log('-'.repeat(80));
      businessEmails.forEach((record, index) => {
        console.log(`${index + 1}. ${record.email}`);
        if (record.businessName) console.log(`   Business: ${record.businessName}`);
        if (record.contactName) console.log(`   Contact: ${record.contactName}`);
        console.log(`   ID: ${record.id}`);
        console.log('');
      });
    }

    if (memberEmails.length > 0) {
      console.log(`\n👤 MEMBER/CUSTOMER EMAILS (${memberEmails.length}):`);
      console.log('-'.repeat(80));
      memberEmails.forEach((record, index) => {
        console.log(`${index + 1}. ${record.email}`);
        if (record.name) console.log(`   Name: ${record.name}`);
        console.log(`   ID: ${record.id}`);
        console.log('');
      });
    }

    // Export to JSON
    const outputPath = resolve(__dirname, '../emails-export.json');
    const fs = require('fs');
    fs.writeFileSync(outputPath, JSON.stringify(emails, null, 2));
    console.log(`\n💾 Exported to: ${outputPath}`);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY:');
    console.log(`  Total Emails: ${emails.length}`);
    console.log(`  Business Emails: ${businessEmails.length}`);
    console.log(`  Member Emails: ${memberEmails.length}`);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  } finally {
    await redis.quit();
    console.log('👋 Disconnected from Redis');
  }
}

// Run the script
listAllEmails().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});







