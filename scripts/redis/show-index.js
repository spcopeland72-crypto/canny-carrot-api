/**
 * Show token-link index contents via API (no local Redis or build).
 * Uses GET /api/v1/redis/index — same API that serves Clare's and The Stables data.
 *
 * Usage (from canny-carrot-api):
 *   node scripts/redis/show-index.js
 *
 * Options: API_URL (default https://api.cannycarrot.com)
 *
 * Output: business:*:customers, token:*:customers, customer:*:businesses, customer:*:tokens
 *
 * See: CODEX/TOOLS_MANIFEST.md, CODEX/TOKEN_LINK_INDEXES.md, scripts/redis/README.md
 */
const API_URL = (process.env.API_URL || 'https://api.cannycarrot.com').replace(/\/$/, '');

async function main() {
  const res = await fetch(`${API_URL}/api/v1/redis/index`);
  const text = await res.text();
  if (!res.ok) {
    console.error(`Failed: ${res.status}`);
    console.error(text.slice(0, 500));
    process.exitCode = 1;
    return;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error('Invalid JSON response:', text.slice(0, 200));
    process.exitCode = 1;
    return;
  }
  if (json.error) {
    console.error('API error:', json.error);
    process.exitCode = 1;
    return;
  }
  const data = json.data;
  if (data == null || typeof data !== 'object') {
    console.error('Unexpected response: missing or invalid data');
    process.exitCode = 1;
    return;
  }
  const keys = Object.keys(data).sort();
  console.log('=== Token-link index contents ===\n');
  for (const key of keys) {
    const members = data[key];
    const list = Array.isArray(members) ? members : [];
    console.log(key);
    console.log(`  => [${list.length}] ${list.slice(0, 20).join(', ')}${list.length > 20 ? '...' : ''}`);
  }
  if (keys.length === 0) {
    console.log('(no index keys found)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
