/**
 * Check what the Manage Customers API returns (rewards vs campaigns, customer counts).
 * Helps debug "rewards show but no campaigns".
 *
 * Usage (from canny-carrot-api):
 *   BUSINESS_ID=<uuid> node scripts/redis/check-manage-customers-api.js
 * Or with API URL:
 *   API_URL=https://api.cannycarrot.com BUSINESS_ID=<uuid> node scripts/redis/check-manage-customers-api.js
 *
 * Get BUSINESS_ID from your business login or from show-index.js (business:*:customers keys).
 */
const API_URL = (process.env.API_URL || 'https://api.cannycarrot.com').replace(/\/$/, '');
const BUSINESS_ID = (process.env.BUSINESS_ID || '').trim();

async function main() {
  if (!BUSINESS_ID) {
    console.error('Set BUSINESS_ID to your business UUID. Example: BUSINESS_ID=abc-123 node scripts/redis/check-manage-customers-api.js');
    process.exitCode = 1;
    return;
  }
  const url = `${API_URL}/api/v1/businesses/${BUSINESS_ID}/tokens/with-customers`;
  console.log('Fetching:', url, '\n');
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) {
    console.error('API status:', res.status);
    console.error(text.slice(0, 500));
    process.exitCode = 1;
    return;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error('Invalid JSON:', text.slice(0, 200));
    process.exitCode = 1;
    return;
  }
  const tokens = json.data?.tokens ?? [];
  if (!Array.isArray(tokens)) {
    console.error('Unexpected response: data.tokens not an array');
    process.exitCode = 1;
    return;
  }
  const rewards = tokens.filter((t) => t.type === 'reward');
  const campaigns = tokens.filter((t) => t.type === 'campaign');
  console.log('=== Manage Customers API summary ===');
  console.log('Reward tokens:', rewards.length);
  rewards.forEach((t) => console.log('  -', t.name, '| customers:', (t.customers || []).length));
  console.log('Campaign tokens:', campaigns.length);
  campaigns.forEach((t) => console.log('  -', t.name, '| customers:', (t.customers || []).length));
  console.log('\nIf campaign tokens are 0: business has no campaigns in Redis (business:*:campaigns).');
  console.log('If campaign tokens exist but each has 0 customers: run backfill-token-index.js and redeploy API (rewards and campaigns use same id format).');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
