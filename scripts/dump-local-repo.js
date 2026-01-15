#!/usr/bin/env node
/**
 * Local Repository Dumper - Browser-based
 * 
 * This script dumps the local repository from business.cannycarrot.com
 * by automating a browser session and extracting AsyncStorage/localStorage data.
 * 
 * Usage:
 *   node scripts/dump-local-repo.js --email laverickclare@hotmail.com --password yourpassword
 *   node scripts/dump-local-repo.js --email laverickclare@hotmail.com --password yourpassword --output local-repo-dump.json
 * 
 * Requirements:
 *   - Node.js 18+
 *   - Puppeteer installed: npm install puppeteer
 *   - Access to business.cannycarrot.com
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Check if puppeteer is available
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.error('❌ Puppeteer not found. Install it with: npm install puppeteer');
  console.log('\nAlternatively, use the browser console script:');
  console.log('  Open business.cannycarrot.com in your browser');
  console.log('  Open Developer Console (F12)');
  console.log('  Copy and paste the contents of: scripts/dump-local-repo-browser.js');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const email = getArg('--email') || getArg('-e');
const password = getArg('--password') || getArg('-p');
const outputFile = getArg('--output') || getArg('-o');
const url = getArg('--url') || getArg('-u') || 'https://business.cannycarrot.com';
const headless = getArg('--headless') !== 'false'; // Default to headless
const waitTime = parseInt(getArg('--wait') || '5000', 10); // Wait time after login in ms

// Validate arguments
if (!email || !password) {
  console.error('❌ Error: --email and --password are required');
  console.log('\nUsage:');
  console.log('  node dump-local-repo.js --email user@example.com --password yourpassword');
  console.log('  node dump-local-repo.js --email user@example.com --password yourpassword --output dump.json');
  console.log('\nOptions:');
  console.log('  --email, -e       Business account email');
  console.log('  --password, -p    Business account password');
  console.log('  --output, -o      Output file path (optional)');
  console.log('  --url, -u         Website URL (default: https://business.cannycarrot.com)');
  console.log('  --headless false  Run browser in visible mode (default: headless)');
  console.log('  --wait 5000       Wait time after login in ms (default: 5000)');
  process.exit(1);
}

/**
 * Extract local repository data from browser
 */
async function extractLocalRepo(page) {
  console.log('🔍 Extracting local repository data from browser...\n');
  
  // React Native AsyncStorage on web uses localStorage with a prefix
  // The prefix is typically '@AsyncStorage:' or similar
  // Let's try to find all AsyncStorage keys
  const repoData = await page.evaluate(() => {
    const REPOSITORY_KEYS = {
      BUSINESS_PROFILE: 'local_repo:business_profile',
      REWARDS: 'local_repo:rewards',
      CAMPAIGNS: 'local_repo:campaigns',
      CUSTOMERS: 'local_repo:customers',
      SYNC_METADATA: 'local_repo:sync_metadata',
      LAST_SYNC: 'local_repo:last_sync',
      CURRENT_BUSINESS_ID: 'local_repo:current_business_id',
    };
    
    // AsyncStorage on web uses localStorage with @AsyncStorage prefix
    // But we need to check the actual implementation
    // Try multiple storage methods
    
    const data = {
      timestamp: new Date().toISOString(),
      storageMethod: 'unknown',
      allKeys: [],
      repository: {
        businessProfile: null,
        rewards: [],
        campaigns: [],
        customers: [],
        syncMetadata: null,
        lastSync: null,
        currentBusinessId: null,
        auth: null,
      },
      archivedRepos: {},
      rawStorage: {},
    };
    
    // Method 1: Check localStorage directly (React Native Web might use this)
    try {
      const localStorageKeys = Object.keys(localStorage);
      data.allKeys = localStorageKeys;
      data.storageMethod = 'localStorage';
      
      // Check for AsyncStorage keys (various possible prefixes)
      const asyncStoragePrefixes = ['@AsyncStorage:', 'asyncStorage:', 'RNAsyncStorage:', ''];
      
      for (const prefix of asyncStoragePrefixes) {
        // Try to find repository keys
        for (const [key, storageKey] of Object.entries(REPOSITORY_KEYS)) {
          const fullKey = prefix + storageKey;
          if (localStorage.getItem(fullKey) !== null) {
            try {
              const value = localStorage.getItem(fullKey);
              const parsed = JSON.parse(value);
              data.rawStorage[fullKey] = parsed;
              
              // Map to repository structure
              switch (key) {
                case 'BUSINESS_PROFILE':
                  data.repository.businessProfile = parsed;
                  break;
                case 'REWARDS':
                  data.repository.rewards = Array.isArray(parsed) ? parsed : [];
                  break;
                case 'CAMPAIGNS':
                  data.repository.campaigns = Array.isArray(parsed) ? parsed : [];
                  break;
                case 'CUSTOMERS':
                  data.repository.customers = Array.isArray(parsed) ? parsed : [];
                  break;
                case 'SYNC_METADATA':
                  data.repository.syncMetadata = parsed;
                  break;
                case 'LAST_SYNC':
                  data.repository.lastSync = parsed;
                  break;
                case 'CURRENT_BUSINESS_ID':
                  data.repository.currentBusinessId = parsed;
                  break;
              }
            } catch (e) {
              // Not JSON, store as string
              data.rawStorage[fullKey] = localStorage.getItem(fullKey);
            }
          }
        }
        
        // Look for auth keys
        const authKey = prefix + 'auth_business';
        if (localStorage.getItem(authKey) !== null) {
          try {
            data.repository.auth = JSON.parse(localStorage.getItem(authKey));
          } catch (e) {
            data.repository.auth = localStorage.getItem(authKey);
          }
        }
        
        // Look for archived repositories
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix + 'archived_repo:')) {
            try {
              data.archivedRepos[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
              data.archivedRepos[key] = localStorage.getItem(key);
            }
          }
        }
      }
      
      // Also try direct key lookups without prefix (in case stored directly)
      for (const [key, storageKey] of Object.entries(REPOSITORY_KEYS)) {
        if (localStorage.getItem(storageKey) !== null) {
          try {
            const value = localStorage.getItem(storageKey);
            const parsed = JSON.parse(value);
            data.rawStorage[storageKey] = parsed;
            
            // Map to repository structure (only if not already set)
            if (key === 'BUSINESS_PROFILE' && !data.repository.businessProfile) {
              data.repository.businessProfile = parsed;
            } else if (key === 'REWARDS' && data.repository.rewards.length === 0) {
              data.repository.rewards = Array.isArray(parsed) ? parsed : [];
            } else if (key === 'CAMPAIGNS' && data.repository.campaigns.length === 0) {
              data.repository.campaigns = Array.isArray(parsed) ? parsed : [];
            } else if (key === 'CUSTOMERS' && data.repository.customers.length === 0) {
              data.repository.customers = Array.isArray(parsed) ? parsed : [];
            } else if (key === 'SYNC_METADATA' && !data.repository.syncMetadata) {
              data.repository.syncMetadata = parsed;
            }
          } catch (e) {
            data.rawStorage[storageKey] = localStorage.getItem(storageKey);
          }
        }
      }
      
      // Check for auth in various possible keys
      const authKeys = ['auth_business', 'business_auth', 'AUTH_STORAGE_KEY'];
      for (const authKey of authKeys) {
        if (localStorage.getItem(authKey) !== null) {
          try {
            data.repository.auth = JSON.parse(localStorage.getItem(authKey));
            break;
          } catch (e) {
            // Not JSON
          }
        }
      }
      
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      data.error = error.message;
    }
    
    // Method 2: Check IndexedDB (if AsyncStorage uses it)
    // This is more complex and would require async/await, so we'll skip for now
    
    return data;
  });
  
  return repoData;
}

/**
 * Login to business app
 */
async function loginToApp(page, email, password) {
  console.log(`🌐 Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  console.log('🔐 Logging in...');
  
  // Wait for login form
  await page.waitForSelector('input[type="email"], input[placeholder*="email" i], input[name*="email" i]', { timeout: 10000 });
  
  // Find and fill email field
  const emailSelector = 'input[type="email"], input[placeholder*="email" i], input[name*="email" i]';
  await page.waitForSelector(emailSelector, { visible: true });
  await page.type(emailSelector, email, { delay: 100 });
  
  // Find and fill password field
  const passwordSelector = 'input[type="password"]';
  await page.waitForSelector(passwordSelector, { visible: true });
  await page.type(passwordSelector, password, { delay: 100 });
  
  // Submit form
  const submitSelector = 'button[type="submit"], button:has-text("Login"), button:has-text("Sign In")';
  await page.waitForSelector(submitSelector, { timeout: 5000 }).catch(() => {
    // Try clicking anywhere that might submit
    return page.keyboard.press('Enter');
  });
  
  await page.click(submitSelector).catch(async () => {
    // Fallback: press Enter
    await page.keyboard.press('Enter');
  });
  
  console.log('⏳ Waiting for login to complete...');
  
  // Wait for navigation or home screen (look for elements that appear after login)
  try {
    await page.waitForFunction(
      () => {
        // Check if we're past the login screen
        const loginInputs = document.querySelectorAll('input[type="email"], input[type="password"]');
        const hasHomeContent = document.querySelector('[class*="Home"], [class*="Dashboard"], [class*="Reward"]');
        return loginInputs.length === 0 || hasHomeContent !== null;
      },
      { timeout: 15000 }
    );
    console.log('✅ Login successful (or page loaded)');
  } catch (e) {
    console.log('⚠️  Login timeout - continuing anyway (might already be logged in)');
  }
  
  // Wait additional time for data to load
  await page.waitForTimeout(waitTime);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Local Repository Dumper (Browser-based)\n');
  console.log(`Target URL: ${url}`);
  console.log(`Email: ${email}`);
  console.log(`Headless: ${headless ? 'Yes' : 'No'}\n`);
  
  let browser;
  
  try {
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enable console logging from page
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        console.error(`[Browser Console] ${msg.text()}`);
      }
    });
    
    // Login
    await loginToApp(page, email, password);
    
    // Extract repository data
    const repoData = await extractLocalRepo(page);
    
    // Enhance with summary
    const dump = {
      ...repoData,
      summary: {
        businessProfile: repoData.repository.businessProfile ? 'Found' : 'Not found',
        rewardsCount: repoData.repository.rewards.length,
        campaignsCount: repoData.repository.campaigns.length,
        customersCount: repoData.repository.customers.length,
        syncMetadata: repoData.repository.syncMetadata ? 'Found' : 'Not found',
        auth: repoData.repository.auth ? 'Found' : 'Not found',
        archivedReposCount: Object.keys(repoData.archivedRepos).length,
        totalStorageKeys: repoData.allKeys.length,
      },
    };
    
    // Output results
    console.log('\n' + '='.repeat(80));
    console.log('📄 LOCAL REPOSITORY DUMP');
    console.log('='.repeat(80) + '\n');
    
    const output = JSON.stringify(dump, null, 2);
    
    if (outputFile) {
      fs.writeFileSync(outputFile, output, 'utf8');
      console.log(`✅ Repository dumped to: ${outputFile}`);
    } else {
      console.log(output);
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Business Profile: ${dump.summary.businessProfile}`);
    console.log(`Rewards: ${dump.summary.rewardsCount}`);
    console.log(`Campaigns: ${dump.summary.campaignsCount}`);
    console.log(`Customers: ${dump.summary.customersCount}`);
    console.log(`Sync Metadata: ${dump.summary.syncMetadata}`);
    console.log(`Auth: ${dump.summary.auth}`);
    console.log(`Archived Repos: ${dump.summary.archivedReposCount}`);
    console.log(`Total Storage Keys: ${dump.summary.totalStorageKeys}`);
    console.log('='.repeat(80) + '\n');
    
    await browser.close();
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

// Run
main();



