# ⚠️ REMOVE BEFORE PRODUCTION: Redis Write Monitor

## Status: TEMPORARY DEBUG FEATURE

**CRITICAL: This entire feature must be removed before production release.**

## What It Does

Monitors and blocks unauthorized Redis writes **FROM THE APPS**. Only allows app writes during:
- Manual sync
- Logout
- Login update check

**EXEMPTIONS (always allowed):**
- Business creation from website (POST /api/v1/businesses)
- Customer creation from website (POST /api/v1/customers)
- Any website/API-originated writes

All other app-originated writes are **BLOCKED** and **FLAGGED** for debugging.

## Files to Remove

1. **`src/middleware/redisWriteMonitor.ts`** - The monitor middleware
2. **Debug endpoints in `src/index.ts`**:
   - `GET /api/v1/debug/blocked-writes`
   - `DELETE /api/v1/debug/blocked-writes`
3. **Middleware imports and usage in**:
   - `src/routes/businesses.ts` - Remove `redisWriteMonitor('business')` from PUT endpoint
   - `src/routes/rewards.ts` - Remove `redisWriteMonitor('reward')` from POST and PUT endpoints
   - `src/routes/campaigns.ts` - Remove `redisWriteMonitor('campaign')` from POST and PUT endpoints

## How to Remove

### Step 1: Remove middleware file
```bash
rm src/middleware/redisWriteMonitor.ts
```

### Step 2: Remove from routes

**businesses.ts:**
- Remove import: `import { redisWriteMonitor } from '../middleware/redisWriteMonitor';`
- Remove from PUT endpoint: `router.put('/:id', redisWriteMonitor('business'), asyncHandler(...))`
- Change to: `router.put('/:id', asyncHandler(...))`

**rewards.ts:**
- Remove import: `import { redisWriteMonitor } from '../middleware/redisWriteMonitor';`
- Remove from POST endpoint: `router.post('/', redisWriteMonitor('reward'), asyncHandler(...))`
- Remove from PUT endpoint: `router.put('/:id', redisWriteMonitor('reward'), asyncHandler(...))`

**campaigns.ts:**
- Remove import: `import { redisWriteMonitor } from '../middleware/redisWriteMonitor';`
- Remove from POST endpoint: `router.post('/', redisWriteMonitor('campaign'), asyncHandler(...))`
- Remove from PUT endpoint: `router.put('/:id', redisWriteMonitor('campaign'), asyncHandler(...))`

### Step 3: Remove debug endpoints from index.ts

Remove:
```typescript
import { getBlockedWritesHandler, clearBlockedWrites } from './middleware/redisWriteMonitor';

// And remove these endpoints:
app.get('/api/v1/debug/blocked-writes', getBlockedWritesHandler);
app.delete('/api/v1/debug/blocked-writes', (req, res) => {
  clearBlockedWrites();
  res.json({ success: true, message: 'Blocked writes log cleared' });
});
```

## Why It Exists

This was added to enforce the rule:
**"Redis writes from the apps only on sync or logout and an update check on login"**

It blocks and flags any writes that don't come from these allowed contexts, helping identify code that violates this rule.

## When to Remove

**BEFORE PRODUCTION RELEASE** - This is a development/debugging tool only.

## Testing

After removal, verify:
1. Manual sync still works
2. Logout still syncs data
3. Login update check still works
4. No 403 errors on legitimate writes

## Last Updated
2026-01-17

