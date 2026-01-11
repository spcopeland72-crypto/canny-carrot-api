# Debug Redis Write Issues

## Current Status

Registration attempts are failing because Redis connections are timing out on Vercel.

## Connection Flow

1. Registration form submits to `/api/send-verification`
2. `send-verification.ts` calls `${apiUrl}/api/v1/redis/set` (creates record)
3. `send-verification.ts` calls `${apiUrl}/api/v1/redis/sadd` (adds to list)
4. `send-verification.ts` calls `${apiUrl}/api/v1/redis/smembers` (verifies)

## Issues Identified

### Issue 1: Redis Connection Timeout on Vercel
- **Error:** `ETIMEDOUT` - Connection timeout after 10 seconds
- **Cause:** Redis Cloud firewall may be blocking Vercel IPs
- **Fix Options:**
  1. Allow all IPs in Redis Cloud (0.0.0.0/0) - for development
  2. Use Redis TLS connection (`rediss://`) if available
  3. Verify Redis Cloud allows outbound connections

### Issue 2: Lazy Connection Not Working
- Connection middleware in `redis.ts` tries to connect on first request
- If connection fails, entire request fails
- Need better error handling and retry logic

### Issue 3: No Connection Pooling
- Each serverless function invocation may create new connection
- Connections may not be reused properly

## Debugging Steps

### Step 1: Test Local Connection
```bash
cd canny-carrot-api
npm run dev
# In another terminal:
curl -X POST http://localhost:3001/api/v1/redis/set \
  -H "Content-Type: application/json" \
  -d '{"args":["test:key","test-value"]}'
```

### Step 2: Check Redis Cloud Settings
1. Log into Redis Cloud Dashboard
2. Check database → Security/Network
3. Verify IP whitelist allows all (0.0.0.0/0) OR disable whitelist
4. Verify TLS is enabled (use `rediss://` URL)

### Step 3: Test Vercel Connection
After fixing Redis Cloud settings, test via:
```bash
curl -X POST https://api.cannycarrot.com/api/v1/redis/set \
  -H "Content-Type: application/json" \
  -d '{"args":["test:key","test-value"]}'
```

### Step 4: Check Vercel Logs
- Go to Vercel dashboard → API project → Logs
- Look for Redis connection errors
- Check for `ETIMEDOUT` or connection refused errors

## Quick Fix: Allow All IPs in Redis Cloud

1. Log into Redis Cloud
2. Select your database
3. Go to "Security" or "Network" tab
4. Find "IP Whitelist" or "Allowed IPs"
5. Either:
   - Disable IP whitelist entirely (if password auth is enabled)
   - OR add `0.0.0.0/0` to allow all IPs

⚠️ **Note:** Allowing all IPs is acceptable if:
- Redis requires password authentication (it does - password in URL)
- This is for development/testing
- For production, consider using VPC peering or private endpoints

## Next Steps

1. ✅ Fix Redis Cloud firewall settings
2. ✅ Verify Redis URL uses TLS if available (`rediss://`)
3. ✅ Test connection from Vercel
4. ✅ Test registration flow end-to-end
5. ✅ Verify data appears in Redis and admin console



## Current Status

Registration attempts are failing because Redis connections are timing out on Vercel.

## Connection Flow

1. Registration form submits to `/api/send-verification`
2. `send-verification.ts` calls `${apiUrl}/api/v1/redis/set` (creates record)
3. `send-verification.ts` calls `${apiUrl}/api/v1/redis/sadd` (adds to list)
4. `send-verification.ts` calls `${apiUrl}/api/v1/redis/smembers` (verifies)

## Issues Identified

### Issue 1: Redis Connection Timeout on Vercel
- **Error:** `ETIMEDOUT` - Connection timeout after 10 seconds
- **Cause:** Redis Cloud firewall may be blocking Vercel IPs
- **Fix Options:**
  1. Allow all IPs in Redis Cloud (0.0.0.0/0) - for development
  2. Use Redis TLS connection (`rediss://`) if available
  3. Verify Redis Cloud allows outbound connections

### Issue 2: Lazy Connection Not Working
- Connection middleware in `redis.ts` tries to connect on first request
- If connection fails, entire request fails
- Need better error handling and retry logic

### Issue 3: No Connection Pooling
- Each serverless function invocation may create new connection
- Connections may not be reused properly

## Debugging Steps

### Step 1: Test Local Connection
```bash
cd canny-carrot-api
npm run dev
# In another terminal:
curl -X POST http://localhost:3001/api/v1/redis/set \
  -H "Content-Type: application/json" \
  -d '{"args":["test:key","test-value"]}'
```

### Step 2: Check Redis Cloud Settings
1. Log into Redis Cloud Dashboard
2. Check database → Security/Network
3. Verify IP whitelist allows all (0.0.0.0/0) OR disable whitelist
4. Verify TLS is enabled (use `rediss://` URL)

### Step 3: Test Vercel Connection
After fixing Redis Cloud settings, test via:
```bash
curl -X POST https://api.cannycarrot.com/api/v1/redis/set \
  -H "Content-Type: application/json" \
  -d '{"args":["test:key","test-value"]}'
```

### Step 4: Check Vercel Logs
- Go to Vercel dashboard → API project → Logs
- Look for Redis connection errors
- Check for `ETIMEDOUT` or connection refused errors

## Quick Fix: Allow All IPs in Redis Cloud

1. Log into Redis Cloud
2. Select your database
3. Go to "Security" or "Network" tab
4. Find "IP Whitelist" or "Allowed IPs"
5. Either:
   - Disable IP whitelist entirely (if password auth is enabled)
   - OR add `0.0.0.0/0` to allow all IPs

⚠️ **Note:** Allowing all IPs is acceptable if:
- Redis requires password authentication (it does - password in URL)
- This is for development/testing
- For production, consider using VPC peering or private endpoints

## Next Steps

1. ✅ Fix Redis Cloud firewall settings
2. ✅ Verify Redis URL uses TLS if available (`rediss://`)
3. ✅ Test connection from Vercel
4. ✅ Test registration flow end-to-end
5. ✅ Verify data appears in Redis and admin console


