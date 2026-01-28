# Customer Account — One Blob, One Array, Translate at Edges

**Idea:** Hold all app data (user account + rewards/campaigns) in **one record**. One **array** for rewards. **Translate** that array **into app** on the app side; **translate** that array **to Redis schema** on the API/Redis side.

---

## 1. Single customer record

**Redis:** One document per customer at `customer:{id}`.

```
{ ...account, rewards: [ ... ] }
```

- **account:** id, email, firstName, lastName, phone, createdAt, updatedAt, preferences, etc.
- **rewards:** Array of reward/campaign items (same logical data as View Business).

---

## 2. Translation at the edges

| Direction | Where | What |
|-----------|--------|-----|
| **App → API** | API | Receive app-shaped payload. Translate array → Redis schema. Store. |
| **API → App** | API | Read from Redis. Translate Redis schema → app shape. Return. |
| **App receives** | App | Translate returned array into app (View Business, etc.). |
| **App sends** | App | Translate app data into array format for API. |

All translation happens at the boundaries. No extra layers.

---

## 3. API contract

- **GET /api/v1/customers/by-email/:email** — Resolve by email, return full record (account + rewards). API translates Redis → app shape.
- **GET /api/v1/customers/:id** — Return full record (account + rewards). Same translation.
- **PUT /api/v1/customers/:id** — Body: `{ ...account, rewards: [...] }`. API translates app → Redis schema, stores. (Alternatively a dedicated `PUT /:id` “full replace” or `PUT /:id/account` + `PUT /:id/rewards`; single PUT keeps it one blob.)

---

## 4. Redis schema (canonical)

Store whatever canonical shape we choose (e.g. normalized field names, extra metadata). API **encode** (app → Redis) and **decode** (Redis → app) so app and Redis never need to know each other’s format.

---

## 5. Clare Langley

- Email: **laverickclare@hotmail.com**
- One customer account (UUID). Resolve by email when wiring app. See **API_AND_CUSTOMER_APP_SCOPE.md** for API + customer-app scope.
