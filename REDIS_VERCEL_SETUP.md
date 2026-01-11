# Redis Connection Setup for Vercel

## Issue
Redis connections are timing out on Vercel with `ETIMEDOUT` errors.

## Root Cause
Vercel's serverless functions have dynamic IP addresses, and Redis Cloud may be blocking connections if firewall/whitelist rules are enabled.

## Solution

### Option 1: Allow All IPs (Recommended for Development)
1. Log into Redis Cloud Dashboard
2. Go to your database configuration
3. Find "Security" or "Network" settings
4. **Disable IP whitelist** or add `0.0.0.0/0` to allow all IPs
5. ⚠️ **Warning**: This makes your Redis accessible from anywhere. Only do this if your Redis requires authentication (which it should via password in the connection URL).

### Option 2: Use Redis Cloud Private Endpoint (Recommended for Production)
1. Redis Cloud offers private endpoints (VPC/VNet)
2. However, Vercel serverless functions cannot use private endpoints directly
3. You would need a proxy or different architecture

### Option 3: Use Vercel KV (Alternative)
If Redis Cloud continues to have issues, consider migrating to Vercel KV:
- Built-in integration with Vercel
- No firewall issues
- Similar Redis API
- Requires code changes

## Current Implementation

The code has been updated to:
- ✅ Connect lazily (only when needed, not on module load)
- ✅ Handle timeouts gracefully (10 second timeout)
- ✅ Reuse connections across warm invocations
- ✅ Skip ready check to avoid timeout issues

## Testing

After updating Redis Cloud firewall settings:
1. Deploy the updated code to Vercel
2. Test a registration
3. Check Vercel logs for Redis connection status
4. Verify data is written to Redis

## Redis URL Format

Ensure your `REDIS_URL` environment variable is set correctly in Vercel:
```
redis://default:PASSWORD@HOST:PORT
```

Example:
```
redis://default:9dVAwjHBBYVACe68zaMZ68MYppVhtFFX@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877
```



## Issue
Redis connections are timing out on Vercel with `ETIMEDOUT` errors.

## Root Cause
Vercel's serverless functions have dynamic IP addresses, and Redis Cloud may be blocking connections if firewall/whitelist rules are enabled.

## Solution

### Option 1: Allow All IPs (Recommended for Development)
1. Log into Redis Cloud Dashboard
2. Go to your database configuration
3. Find "Security" or "Network" settings
4. **Disable IP whitelist** or add `0.0.0.0/0` to allow all IPs
5. ⚠️ **Warning**: This makes your Redis accessible from anywhere. Only do this if your Redis requires authentication (which it should via password in the connection URL).

### Option 2: Use Redis Cloud Private Endpoint (Recommended for Production)
1. Redis Cloud offers private endpoints (VPC/VNet)
2. However, Vercel serverless functions cannot use private endpoints directly
3. You would need a proxy or different architecture

### Option 3: Use Vercel KV (Alternative)
If Redis Cloud continues to have issues, consider migrating to Vercel KV:
- Built-in integration with Vercel
- No firewall issues
- Similar Redis API
- Requires code changes

## Current Implementation

The code has been updated to:
- ✅ Connect lazily (only when needed, not on module load)
- ✅ Handle timeouts gracefully (10 second timeout)
- ✅ Reuse connections across warm invocations
- ✅ Skip ready check to avoid timeout issues

## Testing

After updating Redis Cloud firewall settings:
1. Deploy the updated code to Vercel
2. Test a registration
3. Check Vercel logs for Redis connection status
4. Verify data is written to Redis

## Redis URL Format

Ensure your `REDIS_URL` environment variable is set correctly in Vercel:
```
redis://default:PASSWORD@HOST:PORT
```

Example:
```
redis://default:9dVAwjHBBYVACe68zaMZ68MYppVhtFFX@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877
```


