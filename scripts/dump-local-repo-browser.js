/**
 * Local Repository Dumper - Browser Console Script
 * 
 * Run this script directly in the browser console on business.cannycarrot.com
 * after logging in.
 * 
 * Usage:
 *   1. Navigate to https://business.cannycarrot.com
 *   2. Log in to your account
 *   3. Open Developer Console (F12 or Right-click > Inspect > Console)
 *   4. Copy and paste this entire script
 *   5. Press Enter
 *   6. Copy the output JSON and save to a file
 * 
 * No dependencies required - works directly in browser console
 */

(async function dumpLocalRepository() {
  console.log('🔍 Dumping local repository from business.cannycarrot.com...\n');
  
  const REPOSITORY_KEYS = {
    BUSINESS_PROFILE: 'local_repo:business_profile',
    REWARDS: 'local_repo:rewards',
    CAMPAIGNS: 'local_repo:campaigns',
    CUSTOMERS: 'local_repo:customers',
    SYNC_METADATA: 'local_repo:sync_metadata',
    LAST_SYNC: 'local_repo:last_sync',
    CURRENT_BUSINESS_ID: 'local_repo:current_business_id',
  };
  
  const data = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    storageMethod: 'localStorage',
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
  
  try {
    // Get all localStorage keys
    const localStorageKeys = Object.keys(localStorage);
    data.allKeys = localStorageKeys;
    
    console.log(`📋 Found ${localStorageKeys.length} keys in localStorage\n`);
    
    // React Native AsyncStorage on web might use different prefixes
    // Check multiple possible formats
    const prefixes = ['', '@AsyncStorage:', 'asyncStorage:', 'RNAsyncStorage:'];
    
    for (const prefix of prefixes) {
      // Check each repository key
      for (const [keyName, storageKey] of Object.entries(REPOSITORY_KEYS)) {
        const fullKey = prefix + storageKey;
        const value = localStorage.getItem(fullKey);
        
        if (value !== null) {
          console.log(`✅ Found: ${fullKey}`);
          try {
            const parsed = JSON.parse(value);
            data.rawStorage[fullKey] = parsed;
            
            // Map to repository structure
            switch (keyName) {
              case 'BUSINESS_PROFILE':
                if (!data.repository.businessProfile) {
                  data.repository.businessProfile = parsed;
                }
                break;
              case 'REWARDS':
                if (Array.isArray(parsed)) {
                  data.repository.rewards = parsed;
                  console.log(`   📦 ${parsed.length} rewards found`);
                }
                break;
              case 'CAMPAIGNS':
                if (Array.isArray(parsed)) {
                  data.repository.campaigns = parsed;
                  console.log(`   📦 ${parsed.length} campaigns found`);
                }
                break;
              case 'CUSTOMERS':
                if (Array.isArray(parsed)) {
                  data.repository.customers = parsed;
                  console.log(`   📦 ${parsed.length} customers found`);
                }
                break;
              case 'SYNC_METADATA':
                if (!data.repository.syncMetadata) {
                  data.repository.syncMetadata = parsed;
                  console.log(`   ⏰ Last modified: ${parsed.lastModified || 'N/A'}`);
                }
                break;
              case 'LAST_SYNC':
                data.repository.lastSync = parsed;
                break;
              case 'CURRENT_BUSINESS_ID':
                data.repository.currentBusinessId = parsed;
                console.log(`   🏢 Business ID: ${parsed}`);
                break;
            }
          } catch (e) {
            // Not JSON, store as string
            data.rawStorage[fullKey] = value;
            console.log(`   ⚠️  Value is not JSON: ${value.substring(0, 50)}...`);
          }
        }
      }
      
      // Check for auth keys (various possible formats)
      const authKeys = [
        prefix + 'auth_business',
        prefix + 'business_auth',
        'auth_business',
        'business_auth',
        'AUTH_STORAGE_KEY',
      ];
      
      for (const authKey of authKeys) {
        const authValue = localStorage.getItem(authKey);
        if (authValue !== null && !data.repository.auth) {
          console.log(`✅ Found auth: ${authKey}`);
          try {
            data.repository.auth = JSON.parse(authValue);
            console.log(`   📧 Email: ${data.repository.auth.email || 'N/A'}`);
            console.log(`   🏢 Business ID: ${data.repository.auth.businessId || 'N/A'}`);
          } catch (e) {
            data.repository.auth = authValue;
          }
        }
      }
    }
    
    // Look for archived repositories
    console.log('\n🔍 Checking for archived repositories...');
    for (const key of localStorageKeys) {
      if (key.includes('archived_repo:') || key.startsWith('archived_repo:')) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            data.archivedRepos[key] = JSON.parse(value);
            console.log(`✅ Found archived repo: ${key}`);
          }
        } catch (e) {
          data.archivedRepos[key] = localStorage.getItem(key);
        }
      }
    }
    
    // Also check for any keys that look like repository data
    console.log('\n🔍 Scanning for repository-like keys...');
    const repoPatterns = [
      /^local_repo:/,
      /^archived_repo:/,
      /^auth_/,
      /business.*profile/i,
      /reward/i,
      /campaign/i,
      /customer/i,
      /member/i,
    ];
    
    for (const key of localStorageKeys) {
      if (repoPatterns.some(pattern => pattern.test(key))) {
        if (!data.rawStorage[key] && !key.includes('archived_repo:')) {
          try {
            const value = localStorage.getItem(key);
            if (value) {
              data.rawStorage[key] = JSON.parse(value);
            }
          } catch (e) {
            data.rawStorage[key] = localStorage.getItem(key);
          }
        }
      }
    }
    
    // Create summary
    const summary = {
      businessProfile: data.repository.businessProfile ? '✅ Found' : '❌ Not found',
      rewardsCount: data.repository.rewards.length,
      campaignsCount: data.repository.campaigns.length,
      customersCount: data.repository.customers.length,
      syncMetadata: data.repository.syncMetadata ? '✅ Found' : '❌ Not found',
      auth: data.repository.auth ? '✅ Found' : '❌ Not found',
      archivedReposCount: Object.keys(data.archivedRepos).length,
      totalStorageKeys: localStorageKeys.length,
    };
    
    // Output summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Business Profile: ${summary.businessProfile}`);
    console.log(`Rewards: ${summary.rewardsCount}`);
    console.log(`Campaigns: ${summary.campaignsCount}`);
    console.log(`Customers: ${summary.customersCount}`);
    console.log(`Sync Metadata: ${summary.syncMetadata}`);
    console.log(`Auth: ${summary.auth}`);
    console.log(`Archived Repos: ${summary.archivedReposCount}`);
    console.log(`Total Storage Keys: ${summary.totalStorageKeys}`);
    console.log('='.repeat(80));
    
    // Add summary to data
    data.summary = summary;
    
    // Output full JSON
    console.log('\n📄 Full JSON Data:');
    console.log('='.repeat(80));
    const jsonOutput = JSON.stringify(data, null, 2);
    console.log(jsonOutput);
    console.log('='.repeat(80));
    
    // Copy to clipboard if possible
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonOutput).then(() => {
        console.log('\n✅ JSON copied to clipboard!');
      }).catch(() => {
        console.log('\n💡 Tip: Select the JSON output above and copy it manually');
      });
    } else {
      console.log('\n💡 Tip: Select the JSON output above and copy it to a file');
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Error dumping repository:', error);
    data.error = error.message;
    data.stack = error.stack;
    return data;
  }
})();



