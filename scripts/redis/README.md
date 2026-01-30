# Redis scripts — Canny Carrot API

All scripts that **read or inspect Redis** (customer app data, business data, or full dumps) live in this folder or are listed here. Use this as the single place to find and run Redis inspection tools.

**Folder:** `canny-carrot-api/scripts/redis/`

**Requirements (API-based scripts):** Node.js 18+, no build. They call the API Redis proxy (`POST /api/v1/redis/<command>`). Set `API_URL` if not using production (default `https://api.cannycarrot.com`).

**Requirements (direct Redis):** Scripts that use direct Redis (`read-business-redis-data.js`, `backfill-token-index.js`) need `npm run build` and use `REDIS_URL` from `.env` at `canny-carrot-api` root.

---

## Scripts in this folder

| Script | Purpose | Usage |
|--------|---------|--------|
| **inspect-customer-redis.js** | Read customer record by email (account + embedded rewards; summary). | See [Customer data reading](#customer-data-reading-inspect-customer-redisjs) below. |
| **list-customer-record-redis.js** | **Formatted:** Customer record — Field/Value + Rewards table + Campaigns list. By email or `--id <uuid>`. | See [List customer record](#list-customer-record-list-customer-record-redisjs) below. |
| **read-business-record-api.js** | **Formatted:** Business record — Profile + Rewards table + Campaigns table. API; no build. | `node scripts/redis/read-business-record-api.js <businessId>` |
| **inspect-business-clare-langle-redis.js** | Inspect Redis for business “Clare’s Cakes” (name match). | `node scripts/redis/inspect-business-clare-langle-redis.js` |
| **dump-redis-record.js** | Dump full business or customer record (profile, rewards, campaigns, etc.) to console or file. | See `README-REDIS-DUMP.md` in this folder. |
| **backup-customer-record.js** | Backup customer record to a timestamped file (run before risky operations; restorable). | See [Backup customer record](#backup-customer-record-backup-customer-recordjs) below. |
| **read-business-redis-data.js** | Read business Redis data by business name (direct Redis; build; uses REDIS_URL from .env). | `node scripts/redis/read-business-redis-data.js "The Stables"` |
| **show-index.js** | **Formatted:** Token-link index — Key \| Members table. API; no build. | See [Token-link index](#token-link-index-show-indexjs) below. |
| **backfill-token-index.js** | Populate token-link index from legacy customer records (one-time backfill). Direct Redis; build; uses REDIS_URL from .env. | See [Backfill token index](#backfill-token-index-backfill-token-indexjs) below. |
| **check-manage-customers-api.js** | Check what Manage Customers API returns (reward vs campaign token counts, customer counts per token). API-based; no build. | `BUSINESS_ID=<uuid> node scripts/redis/check-manage-customers-api.js` |

---

## Backfill token index: `backfill-token-index.js`

**Purpose:** One-time backfill of the token-link index from existing customer records. Scans all `customer:*` records, reads `rewards[]` from each, and populates `business:*:customers`, `token:*:customers`, `customer:*:businesses`, `customer:*:tokens`. New token-related activity (customer sync via `replace()`) keeps the index updated automatically.

**Requirements:** `npm run build`. Uses `REDIS_URL` from `.env` at `canny-carrot-api` root.

**Usage:**

```bash
cd canny-carrot-api
npm run build
node scripts/redis/backfill-token-index.js
```

**Output:** Progress, then summary (customers processed, with rewards, SADD counts). No changes to customer record bodies; only index sets are written.

**See also:** [CODEX/TOKEN_LINK_INDEXES.md](../../CODEX/TOKEN_LINK_INDEXES.md).

---

## Manage Customers API check: `check-manage-customers-api.js`

**Purpose:** See what the Manage Customers endpoint returns (rewards vs campaigns, customer counts). Use when rewards show but campaigns don’t.

**Usage:**

```bash
cd canny-carrot-api
BUSINESS_ID=<your-business-uuid> node scripts/redis/check-manage-customers-api.js
```

Use the same `BUSINESS_ID` you use to log into the business app (or get it from `show-index.js` via `business:*:customers` keys). If **Campaign tokens: 0**, the business has no campaigns in Redis (`business:*:campaigns`). If campaign tokens exist but each has **0 customers**, re-run `backfill-token-index.js` and **redeploy the API**. Rewards and campaigns use the same id format (document id, no prefix); re-sync from the customer app or re-seed so the index uses token:{id}:customers for both.

---

## Token-link index: `show-index.js`

**Purpose:** Show the contents of the token-link index: which customers are linked to which businesses and tokens (rewards/campaigns). Uses the same API that serves Clare's and The Stables data. No local Redis or build required.

**API:** `GET /api/v1/redis/index` (returns `{ data: { "key": [members...], ... } }`).

**Redis keys dumped:**

- `business:{businessId}:customers` — customer UUIDs with at least one token from this business
- `token:{tokenId}:customers` — customer UUIDs who have this reward or campaign
- `customer:{customerId}:businesses` — business UUIDs this customer has tokens with
- `customer:{customerId}:tokens` — token UUIDs (reward + campaign ids) this customer has

**Usage:**

```bash
cd canny-carrot-api

node scripts/redis/show-index.js
```

**Options:**

- `API_URL` — API base URL (default `https://api.cannycarrot.com`).

**Output:** **Formatted** — Token-link index as a Key \| Members table. Each row: key, then members as `[count] id1, id2, ...` (up to 50 per key). `(no index keys found)` if empty. Not JSON.

**See also:** [CODEX/TOKEN_LINK_INDEXES.md](../../CODEX/TOKEN_LINK_INDEXES.md), [CODEX/TOOLS_MANIFEST.md](../../CODEX/TOOLS_MANIFEST.md).

---

## Output format (formatted scripts)

These three scripts print **human-readable formatted output** (not raw JSON). Use them when you need "business record, customer record, and index" in a readable form. See [CODEX/TOOLS_MANIFEST.md](../../CODEX/TOOLS_MANIFEST.md) for the manifest and quick commands.

| Script | Output format |
|--------|----------------|
| **read-business-record-api.js** | Header: "Here's what the API returned for {name} (business {id})". Then **Business record** → **Profile** (id, name, email, phone, updatedAt, products, actions) → **Rewards (N)** table: id, name, type, stamps, selectedProducts → **Campaigns (N)** table: id, name, type, selectedProducts, selectedActions. |
| **list-customer-record-redis.js** | Header: "Here's the customer view after refresh, login, scanning campaigns, and sync." Then **Customer account (Name)** → **Field** \| **Value** table (id, email, firstName, lastName, phone, createdAt, updatedAt, totalStamps, totalRedemptions) → **Rewards (N rewards)** table: id, name, pointsEarned/requirement, type → **Campaigns (N in rewards[])** list: for each campaign, name (id: …), Progress x/y, Products, Actions, Collected so far. |
| **show-index.js** | **Token-link index** → **Key** \| **Members** table. Each row: index key, then members as `[count] member1, member2, ...`. Keys: business:*:customers, token:*:customers, customer:*:businesses, customer:*:tokens. |

---

## Customer data reading: `inspect-customer-redis.js`

**Purpose:** Inspect what is stored in Redis for a **customer app** user: email index → customer ID → full customer record (account + embedded `rewards[]`). Use after login/sync to confirm rewards and profile.

**Redis keys used:**

- `customer:email:{email}` → `{ customerId }` (lookup by email)
- `customer:{id}` → full customer record (id, email, firstName, lastName, rewards[], etc.)

**Usage:**

```bash
cd canny-carrot-api

# By email (argument)
node scripts/redis/inspect-customer-redis.js laverickclare@hotmail.com

# By email (env)
CUSTOMER_EMAIL=someone@example.com node scripts/redis/inspect-customer-redis.js

# Default (if no arg/env): laverickclare@hotmail.com
node scripts/redis/inspect-customer-redis.js
```

**Options:**

- `API_URL` — API base URL (default `https://api.cannycarrot.com`).
- `CUSTOMER_EMAIL` or first argument — Customer email (lowercased). Required for a specific customer; script documents default for backward compatibility.

**Output:** Email index, customer ID, full record summary, reward count, and list of rewards/campaigns (name, id, businessId).

**See also:** `CODEX/TIMESTAMP_AND_SYNC.md`, `docs/CUSTOMER_ACCOUNT_REDIS_SCHEMA.md` (if present).

---

## Backup customer record: `backup-customer-record.js`

**Purpose:** Save a timestamped copy of the current customer record from the API (Redis) to `backups/customers/`. Run when you request a backup before risky operations so you can restore if needed. Backups are not committed (folder is in `.gitignore`).

**Usage:**

```bash
cd canny-carrot-api

# By email
node scripts/redis/backup-customer-record.js laverickclare@hotmail.com
node scripts/redis/backup-customer-record.js --email laverickclare@hotmail.com

# By customer UUID
node scripts/redis/backup-customer-record.js --id bbc62a7c-9f55-5382-b6ad-be4ecb53514e
```

**Output:** `backups/customers/customer-{id}-{timestamp}.json` (pretty-printed JSON).

**Env:** `API_URL` — API base (default `https://api.cannycarrot.com`).

---

## Check customer record: `check-customer-record-redis.js`

**Purpose:** Confirm that all data the app sends in the sync body is stored in Redis. Fetches the customer record via the API and checks for every expected top-level key: `id`, `email`, `firstName`, `lastName`, `phone`, `dateOfBirth`, `addressLine1`, `addressLine2`, `city`, `postcode`, `createdAt`, `updatedAt`, `preferences`, `totalStamps`, `totalRedemptions`, `rewards`, `transactionLog`. Use after sync/logout to verify nothing is dropped (API is pass-through).

**Usage:**

```bash
cd canny-carrot-api

# By email
node scripts/redis/check-customer-record-redis.js laverickclare@hotmail.com
node scripts/redis/check-customer-record-redis.js --email laverickclare@hotmail.com

# By customer UUID
node scripts/redis/check-customer-record-redis.js --id bbc62a7c-9f55-5382-b6ad-be4ecb53514e
```

**Output:** Per-key status (ok / absent / MISSING), rewards count, transactionLog count, and whether all expected keys are present. Exit 0 if required keys present; 1 if record missing or required keys missing.

**Env:** `API_URL` — API base (default `https://api.cannycarrot.com`).

---

## List customer record: `list-customer-record-redis.js`

**Purpose:** Fetch the full customer record from the API (Redis-backed) and print it in **formatted** human-readable form (not JSON). Use after customer app login/sync to see account, rewards table, and campaigns list. API-based; no build or REDIS_URL.

**Usage:**

```bash
cd canny-carrot-api

# By email
node scripts/redis/list-customer-record-redis.js laverickclare@hotmail.com
node scripts/redis/list-customer-record-redis.js --email <email>

# By customer UUID
node scripts/redis/list-customer-record-redis.js --id bbc62a7c-9f55-5382-b6ad-be4ecb53514e
```

**Output:** **Formatted** — Header; Customer account (Name) with Field \| Value table; Rewards (N rewards) table; Campaigns (N in rewards[]) with name, id, Progress, Products, Actions, Collected so far. See [Output format (formatted scripts)](#output-format-formatted-scripts) above.

**Env:** `API_URL` — API base (default `https://api.cannycarrot.com`).

---

## Use case: Inspect business record, customer record, and index after sync

After **business app** sync (create campaigns, sync) or **customer app** (refresh, login, scan campaigns, sync), run from `canny-carrot-api`:

```bash
# Business: profile + rewards + campaigns
node scripts/redis/read-business-record-api.js <businessId>

# Customer: full record (account, rewards[], transactionLog)
node scripts/redis/list-customer-record-redis.js --id <customerId>
# or: node scripts/redis/list-customer-record-redis.js <email>

# Token-link index
node scripts/redis/show-index.js
```

See also [CODEX/TOOLS_MANIFEST.md](../../CODEX/TOOLS_MANIFEST.md).

---

## Quick reference

```bash
# Customer record by email
node scripts/redis/inspect-customer-redis.js customer@example.com

# Business “Clare’s Cakes” (hardcoded name match)
node scripts/redis/inspect-business-clare-langle-redis.js

# Backup customer record (timestamped file in backups/customers/)
node scripts/redis/backup-customer-record.js laverickclare@hotmail.com

# Check customer record — all data stored (expected keys present)
node scripts/redis/check-customer-record-redis.js laverickclare@hotmail.com

# List customer record — formatted (Field/Value + Rewards + Campaigns)
node scripts/redis/list-customer-record-redis.js laverickclare@hotmail.com

# Full dump (business or customer) — see README-REDIS-DUMP.md
node scripts/redis/dump-redis-record.js --type customer --id <uuid>
node scripts/redis/dump-redis-record.js --type business --email business@example.com

# Business record — formatted (Profile + Rewards table + Campaigns table)
node scripts/redis/read-business-record-api.js <businessId>

# Business by name (direct Redis)
node scripts/redis/read-business-redis-data.js "The Stables"

# Token-link index — formatted Key | Members table
node scripts/redis/show-index.js

# Backfill token-link index from legacy customer records (direct Redis)
node scripts/redis/backfill-token-index.js
```
