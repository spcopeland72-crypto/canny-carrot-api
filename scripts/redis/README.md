# Redis scripts — Canny Carrot API

All scripts that **read or inspect Redis** (customer app data, business data, or full dumps) live in this folder or are listed here. Use this as the single place to find and run Redis inspection tools.

**Folder:** `canny-carrot-api/scripts/redis/`

**Requirements (API-based scripts):** Node.js 18+, no build. They call the API Redis proxy (`POST /api/v1/redis/<command>`). Set `API_URL` if not using production (default `https://api.cannycarrot.com`).

**Requirements (direct Redis):** For `read-business-redis-data.js`, the API must be built (`npm run build`) and `REDIS_URL` in `.env` at `canny-carrot-api` root.

---

## Scripts in this folder

| Script | Purpose | Usage |
|--------|---------|--------|
| **inspect-customer-redis.js** | Read customer record by email (account + embedded rewards). | See [Customer data reading](#customer-data-reading-inspect-customer-redisjs) below. |
| **inspect-business-clare-langle-redis.js** | Inspect Redis for business “Clare’s Cakes” (name match). | `node scripts/redis/inspect-business-clare-langle-redis.js` |
| **dump-redis-record.js** | Dump full business or customer record (profile, rewards, campaigns, etc.) to console or file. | See `README-REDIS-DUMP.md` in this folder. |
| **backup-customer-record.js** | Backup customer record to a timestamped file (run before risky operations; restorable). | See [Backup customer record](#backup-customer-record-backup-customer-recordjs) below. |
| **read-business-redis-data.js** | Read business Redis data by business name (direct Redis; needs build + REDIS_URL). | `node scripts/redis/read-business-redis-data.js "The Stables"` |

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

# List customer record — everything in Redis (full JSON)
node scripts/redis/list-customer-record-redis.js laverickclare@hotmail.com

# Full dump (business or customer) — see README-REDIS-DUMP.md
node scripts/redis/dump-redis-record.js --type customer --id <uuid>
node scripts/redis/dump-redis-record.js --type business --email business@example.com

# Business by name (direct Redis)
node scripts/redis/read-business-redis-data.js "The Stables"
```
