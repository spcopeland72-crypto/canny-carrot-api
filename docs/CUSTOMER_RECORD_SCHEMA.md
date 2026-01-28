# Canny Carrot Customer Record — Redis Schema

Canonical schema for the customer account document stored in Redis. One blob per customer: **account** + **rewards** array. Translation to/from app shape happens at the API boundary.

**Customer ID:** UUID only. Primary identifier; never use email as id. Design supports extensibility to 10,000,000+ users.

---

## 1. Redis keys

| Key | Type | Description |
|-----|------|-------------|
| `customer:{customerId}` | string (JSON) | Full customer record. `customerId` is a **UUID**. |
| `customer:email:{normalizedEmail}` | string (JSON) | Email → UUID index. Value = `{"customerId":"<uuid>"}`. Normalize email: lowercase, trim. |

---

## 2. Customer record document (`customer:{id}`)

Single JSON object. All fields at top level; `rewards` is the only array.

### 2.1 Account fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Customer ID. Same as key suffix. |
| `email` | string | ✅ | Unique. Normalized (lowercase, trim). |
| `firstName` | string | ✅ | |
| `lastName` | string | ❌ | Default `""`. |
| `phone` | string | ❌ | |
| `createdAt` | string | ✅ | ISO 8601. |
| `updatedAt` | string | ✅ | ISO 8601. |
| `preferences` | object | ❌ | See below. |
| `totalStamps` | number | ❌ | Default `0`. |
| `totalRedemptions` | number | ❌ | Default `0`. |
| `dateOfBirth` | string | ❌ | ISO date. |
| `homeRegion` | string | ❌ | e.g. `"tees-valley"`. |
| `deletedAt` | string | ❌ | ISO 8601. Soft delete. |
| `favoriteBusiness` | string | ❌ | Business ID. |
| `achievements` | string[] | ❌ | |
| `referralCode` | string | ❌ | |
| `referredBy` | string | ❌ | |
| `deviceTokens` | array | ❌ | `{ platform, token, deviceId?, lastActiveAt? }[]`. |

**Preferences** (optional):

```json
{
  "notifications": true,
  "push": true,
  "email": true,
  "sms": false,
  "marketing": false,
  "geofencing": false
}
```

### 2.2 Rewards array

| Field | Type | Description |
|-------|------|-------------|
| `rewards` | array | List of reward/campaign items. Same logical data as customer app View Business. |

Each element (reward/campaign item):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Reward or campaign ID (e.g. `reward-xyz`, `campaign-abc`). |
| `name` | string | ✅ | Display name. |
| `count` | number | ✅ | Current progress (e.g. 1 of 4). |
| `total` | number | ✅ | Total required (e.g. 4). |
| `icon` | string | ❌ | Emoji or icon id. Default `"🎁"`. |
| `pointsEarned` | number | ✅ | Customer-specific points. |
| `requirement` | number | ❌ | Points needed. |
| `pointsPerPurchase` | number | ❌ | Default 1. |
| `rewardType` | string | ❌ | `"free_product"` \| `"discount"` \| `"other"`. |
| `businessId` | string | ❌ | Business ID. |
| `businessName` | string | ❌ | Business display name. |
| `businessLogo` | string | ❌ | URL or base64. |
| `qrCode` | string | ❌ | QR value. |
| `pinCode` | string | ❌ | Redemption PIN. |
| `selectedProducts` | string[] | ❌ | Product names. |
| `selectedActions` | string[] | ❌ | Action names. |
| `collectedItems` | array | ❌ | `{ "itemType": "product"|"action", "itemName": "…" }[]`. Campaign stamps. |
| `createdAt` | string | ❌ | ISO 8601. |
| `lastScannedAt` | string | ❌ | ISO 8601. |
| `isEarned` | boolean | ❌ | Requirement met. |
| `type` | string | ❌ | `"product"` \| `"action"`. |
| `startDate` | string | ❌ | ISO date. Campaign. |
| `endDate` | string | ❌ | ISO date. Campaign. |

---

## 3. Example

```json
{
  "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "email": "laverickclare@hotmail.com",
  "firstName": "Clare",
  "lastName": "Langley",
  "phone": "",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-26T12:00:00.000Z",
  "preferences": {
    "notifications": true,
    "marketing": false
  },
  "totalStamps": 0,
  "totalRedemptions": 0,
  "rewards": [
    {
      "id": "campaign-xyz-scone",
      "name": "Scone but not forgotten",
      "count": 2,
      "total": 4,
      "icon": "🥐",
      "pointsEarned": 2,
      "requirement": 4,
      "businessId": "business_1767744076082_i3d1uu42x",
      "businessName": "The Stables",
      "selectedProducts": ["Earl Grey Tea", "Scone"],
      "selectedActions": ["Write a review"],
      "collectedItems": [
        { "itemType": "product", "itemName": "Earl Grey Tea" },
        { "itemType": "action", "itemName": "Write a review" }
      ],
      "createdAt": "2025-01-15T10:00:00.000Z",
      "lastScannedAt": "2025-01-20T14:30:00.000Z",
      "isEarned": false
    }
  ]
}
```

---

## 4. Email index

- **Key:** `customer:email:{normalizedEmail}`  
- **Value:** `{"customerId":"<id>"}`  
- **Normalize:** `email.toLowerCase().trim()`.

Use to resolve `customerId` from email before reading `customer:{id}`.

---

## 5. Building the schema in Redis

Run the seed script to create Clare Langley's complete customer record (account + rewards/campaigns from app-repository-data):

```bash
cd canny-carrot-api
# Ensure REDIS_URL is set in .env
npm run seed-clare-customer
```

This creates `customer:{uuid}`, `customer:email:laverickclare@hotmail.com`, and `customers:all`. Clare's id is a deterministic UUID. Idempotent unless `--force` is passed.

---

## 6. Versioning

Schema version: **1**. Future changes (new fields, breaking renames) should be noted here and, if needed, a `schemaVersion` field added to the document.
