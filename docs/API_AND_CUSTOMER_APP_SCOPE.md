# Customer Record — API + Customer App Scope

**Scope:** Customer schema, Redis population, and API adapter work spans **two codebases**:

| Codebase | Role |
|----------|------|
| **canny-carrot-api** | Schema, seed, Redis keys, API adapter (customer record service + routes). Customer ID = **UUID**. |
| **canny-carrot-customer-app** | Use UUID (not email/device as id), call by-email / by-id / sync, persist customer UUID locally. |

---

## 1. canny-carrot-api (updates)

- **Schema:** `docs/CUSTOMER_RECORD_SCHEMA.md`, `src/types/customerRecord.ts`. Customer ID is **UUID**; design supports 10M+ users.
- **Redis keys:** `customer:{uuid}`, `customer:email:{normalizedEmail}` → `{"customerId":"<uuid>"}`, `customers:all`.
- **Seed:** `npm run seed-clare-customer` — Clare Langley (laverickclare@hotmail.com), deterministic UUID, rewards/campaigns from app-repository-data.
- **Adapter:** `src/services/customerRecordService.ts` — `getById`, `getByEmail`, `replace`.
- **Routes:** `GET /customers/by-email/:email`, `GET /customers/:id`, `PUT /customers/:id/sync` use the adapter.

---

## 2. canny-carrot-customer-app (updates)

- **Customer ID:** Use **customer UUID** from API. Do not use email or device id as customer identifier when calling the API.
- **Storage:** Persist customer UUID (e.g. `canny_carrot:customer_uuid`) when received from by-email or by-id.
- **API client:** `customerApi` — `getByEmail`, `getById`, `sync(id, body)`. Calls `api.cannycarrot.com`.
- **Sync / logout:** Resolve UUID (stored or via by-email), then `PUT /customers/:id/sync` with `{ ...account, rewards }`. Build payload from local customer record / View Business data; API stores one blob.

---

## 3. Clare Langley

- Email: **laverickclare@hotmail.com**
- Customer id: **UUID** (deterministic in seed). Resolve via `GET /customers/by-email/laverickclare%40hotmail.com`.
