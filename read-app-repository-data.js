/**
 * Read and print rewards and campaigns from app-repository-data.json
 * This file contains what was synced from the app's localStorage to Redis
 */

const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'app-repository-data.json');

if (!fs.existsSync(dataFile)) {
  console.log('❌ app-repository-data.json not found');
  console.log('This file is created when the app syncs from localStorage to Redis');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

console.log('REWARDS:');
console.log('='.repeat(80));
console.log(`Found ${data.rewards.length} rewards:`);
data.rewards.forEach((r, i) => {
  console.log(`${i + 1}. ${r.name || 'Unnamed'} (ID: ${r.id || 'N/A'}) - ${r.stampsRequired || r.costStamps || 0} stamps, ${r.isActive ? 'Active' : 'Inactive'}`);
});
console.log('\nFull rewards JSON:');
console.log(JSON.stringify(data.rewards, null, 2));

console.log('\n\nCAMPAIGNS:');
console.log('='.repeat(80));
console.log(`Found ${data.campaigns.length} campaigns:`);
data.campaigns.forEach((c, i) => {
  console.log(`${i + 1}. ${c.name || 'Unnamed'} (ID: ${c.id || 'N/A'}) - ${c.status || 'N/A'}`);
});
console.log('\nFull campaigns JSON:');
console.log(JSON.stringify(data.campaigns, null, 2));

console.log('\n\nBUSINESS PROFILE:');
console.log('='.repeat(80));
console.log(`Name: ${data.business.name || 'N/A'}`);
console.log(`Email: ${data.business.email || 'N/A'}`);
console.log(`Phone: ${data.business.phone || 'N/A'}`);
console.log(`Address: ${data.business.addressLine1 || ''} ${data.business.postcode || ''}`.trim());
console.log(`Products: ${(data.business.products || []).join(', ')}`);
console.log(`Customers: ${data.customers.length || 0}`);

console.log(`\n\nData synced at: ${data.timestamp}`);
console.log('Source: app-repository-data.json (synced from localStorage to Redis)');

