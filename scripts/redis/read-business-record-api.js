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
  const name = profile.name || profile.id || idOrSlug;
  console.log(`Here's what the API returned for ${name} (business ${profile.id || idOrSlug}):\n`);
  console.log('Business record (profile + rewards + campaigns)\n');
  console.log('Profile');
  console.log('id:', profile.id);
  console.log('name:', profile.name);
  console.log('email:', profile.email ?? '');
  console.log('phone:', profile.phone ?? '');
  console.log('updatedAt:', profile.updatedAt ?? '');
  const products = Array.isArray(profile.products) ? profile.products : [];
  console.log('products:', products.length ? products.join(', ') : '(none)');
  const actions = Array.isArray(profile.actions) ? profile.actions : [];
  console.log('actions:', actions.length ? actions.join(', ') : '[] (empty)');
  console.log('');
  console.log(`Rewards (${rewards.length})`);
  if (rewards.length) {
    console.log('id\tname\ttype\tstamps\tselectedProducts');
    for (const r of rewards) {
      const prods = Array.isArray(r.selectedProducts) ? r.selectedProducts.join(', ') : '';
      console.log(`${r.id}\t${r.name || ''}\t${r.type || ''}\t${r.stampsRequired ?? r.costStamps ?? ''}\t${prods}`);
    }
  } else {
    console.log('(none)');
  }
  console.log('');
  console.log(`Campaigns (${campaigns.length})`);
  if (campaigns.length) {
    console.log('id\tname\ttype\tselectedProducts\tselectedActions');
    for (const c of campaigns) {
      const prods = Array.isArray(c.selectedProducts) ? c.selectedProducts.join(', ') : '';
      const acts = Array.isArray(c.selectedActions) ? c.selectedActions.join(', ') : '';
      console.log(`${c.id}\t${c.name || ''}\t${c.type || ''}\t${prods}\t${acts}`);
    }
  } else {
    console.log('(none)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
