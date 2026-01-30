/**
 * Fetch full business record (profile + rewards + campaigns) via API.
 * No Redis or build required. Uses API_URL (default https://api.cannycarrot.com).
 *
 * Usage (from canny-carrot-api):
 *   node scripts/redis/read-business-record-api.js business_1767744076082_i3d1uu42x
 *   node scripts/redis/read-business-record-api.js "The Stables"
 *
 * With business ID: fetches GET /businesses/:id, GET /rewards?businessId=:id, GET /campaigns?businessId=:id and merges.
 */
const API_URL = (process.env.API_URL || 'https://api.cannycarrot.com').replace(/\/$/, '');
const idOrSlug = (process.argv[2] || '').trim();
if (!idOrSlug) {
  console.error('Usage: node scripts/redis/read-business-record-api.js <businessId-or-slug>');
  console.error('Example: node scripts/redis/read-business-record-api.js business_1767744076082_i3d1uu42x');
  process.exit(1);
}

async function main() {
  const bid = encodeURIComponent(idOrSlug);
  const [businessRes, rewardsRes, campaignsRes] = await Promise.all([
    fetch(`${API_URL}/api/v1/businesses/${bid}`),
    fetch(`${API_URL}/api/v1/rewards?businessId=${bid}`),
    fetch(`${API_URL}/api/v1/campaigns?businessId=${bid}`),
  ]);
  if (!businessRes.ok) {
    console.error(`Business fetch failed: ${businessRes.status}`);
    process.exit(1);
  }
  const businessData = await businessRes.json();
  const profile = businessData.data || businessData;
  const rewardsData = rewardsRes.ok ? await rewardsRes.json() : { data: [] };
  const campaignsData = campaignsRes.ok ? await campaignsRes.json() : { data: [] };
  const rewards = Array.isArray(rewardsData.data) ? rewardsData.data : [];
  const campaigns = Array.isArray(campaignsData.data) ? campaignsData.data : [];
  const record = { ...profile, rewards, campaigns };
  console.log(JSON.stringify(record, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
