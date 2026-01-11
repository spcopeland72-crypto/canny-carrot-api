# Redis Cloud Firewall/IP Whitelist Settings

## Where to Find IP Whitelist Settings

Redis Cloud UI can vary. Try these locations:

### Option 1: Database Configuration (New UI)
1. Log into Redis Cloud Dashboard
2. Click on your **subscription**
3. Click on your **database** name
4. Look for tabs: **"Configuration"**, **"Security"**, **"Network"**, or **"Access Control"**
5. Search for: **"IP Whitelist"**, **"Allowed IPs"**, **"Access List"**, or **"Public endpoint"**

### Option 2: Database Settings (Old UI)
1. Log into Redis Cloud Dashboard
2. Go to **"Databases"** in the left menu
3. Click on your database
4. Look for **"Security"** or **"Access Control"** tab
5. Find **"IP Access List"** or **"Whitelist"**

### Option 3: Subscription Level
1. Click on your **subscription** name
2. Look for **"Security"** or **"Network"** settings
3. Check if IP whitelisting is set at subscription level

### Option 4: If You Can't Find It

**The whitelist might not be enabled!** This means:
- Redis Cloud may be blocking connections for another reason
- Check if your database is **"Active"** and not paused
- Check if you're using the correct endpoint URL
- Verify the password in the connection URL is correct

## Alternative: Check Connection String

Look at your Redis connection URL:
- Format: `redis://default:PASSWORD@HOST:PORT`
- The URL might include connection parameters

## Quick Test: Connection String Format

Your Redis URL should look like:
```
redis://default:9dVAwjHBBYVACe68zaMZ68MYppVhtFFX@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877
```

If your URL starts with `redis://` and includes a password, the connection should work **IF**:
1. The database is active
2. The password is correct
3. IP whitelisting is not enabled (or allows all)

## What to Look For in Redis Cloud

### If Whitelist Exists:
- Option 1: **Disable it** (recommended for development)
- Option 2: Add `0.0.0.0/0` to allow all IPs

### If Whitelist Doesn't Exist:
The database should accept connections from anywhere (with password auth).

## Troubleshooting: Connection Still Fails

If you can't find IP whitelist settings AND connection still fails:

1. **Check Database Status**
   - Is the database "Active"?
   - Is it paused or deleted?

2. **Verify Endpoint URL**
   - Check the exact hostname and port
   - Make sure you're using the public endpoint (not private)

3. **Test Connection Locally**
   ```bash
   # Test if Redis is accessible from your machine
   # This will help identify if it's a Vercel-specific issue
   ```

4. **Check Redis Cloud Region**
   - Database is in `eu-west-2` (London)
   - Vercel should be able to connect to this region

5. **Contact Redis Cloud Support**
   - They can check if there are any network restrictions
   - They can verify if IP whitelisting is enabled at subscription level

## Current Error We're Seeing

```
ETIMEDOUT - Connection timeout after 10 seconds
```

This usually means:
- ✅ Network can reach Redis (no firewall block)
- ❌ But connection handshake is timing out
- Possible causes:
  1. IP whitelist blocking (most likely)
  2. Database not active
  3. Wrong endpoint URL
  4. Network latency issues



## Where to Find IP Whitelist Settings

Redis Cloud UI can vary. Try these locations:

### Option 1: Database Configuration (New UI)
1. Log into Redis Cloud Dashboard
2. Click on your **subscription**
3. Click on your **database** name
4. Look for tabs: **"Configuration"**, **"Security"**, **"Network"**, or **"Access Control"**
5. Search for: **"IP Whitelist"**, **"Allowed IPs"**, **"Access List"**, or **"Public endpoint"**

### Option 2: Database Settings (Old UI)
1. Log into Redis Cloud Dashboard
2. Go to **"Databases"** in the left menu
3. Click on your database
4. Look for **"Security"** or **"Access Control"** tab
5. Find **"IP Access List"** or **"Whitelist"**

### Option 3: Subscription Level
1. Click on your **subscription** name
2. Look for **"Security"** or **"Network"** settings
3. Check if IP whitelisting is set at subscription level

### Option 4: If You Can't Find It

**The whitelist might not be enabled!** This means:
- Redis Cloud may be blocking connections for another reason
- Check if your database is **"Active"** and not paused
- Check if you're using the correct endpoint URL
- Verify the password in the connection URL is correct

## Alternative: Check Connection String

Look at your Redis connection URL:
- Format: `redis://default:PASSWORD@HOST:PORT`
- The URL might include connection parameters

## Quick Test: Connection String Format

Your Redis URL should look like:
```
redis://default:9dVAwjHBBYVACe68zaMZ68MYppVhtFFX@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877
```

If your URL starts with `redis://` and includes a password, the connection should work **IF**:
1. The database is active
2. The password is correct
3. IP whitelisting is not enabled (or allows all)

## What to Look For in Redis Cloud

### If Whitelist Exists:
- Option 1: **Disable it** (recommended for development)
- Option 2: Add `0.0.0.0/0` to allow all IPs

### If Whitelist Doesn't Exist:
The database should accept connections from anywhere (with password auth).

## Troubleshooting: Connection Still Fails

If you can't find IP whitelist settings AND connection still fails:

1. **Check Database Status**
   - Is the database "Active"?
   - Is it paused or deleted?

2. **Verify Endpoint URL**
   - Check the exact hostname and port
   - Make sure you're using the public endpoint (not private)

3. **Test Connection Locally**
   ```bash
   # Test if Redis is accessible from your machine
   # This will help identify if it's a Vercel-specific issue
   ```

4. **Check Redis Cloud Region**
   - Database is in `eu-west-2` (London)
   - Vercel should be able to connect to this region

5. **Contact Redis Cloud Support**
   - They can check if there are any network restrictions
   - They can verify if IP whitelisting is enabled at subscription level

## Current Error We're Seeing

```
ETIMEDOUT - Connection timeout after 10 seconds
```

This usually means:
- ✅ Network can reach Redis (no firewall block)
- ❌ But connection handshake is timing out
- Possible causes:
  1. IP whitelist blocking (most likely)
  2. Database not active
  3. Wrong endpoint URL
  4. Network latency issues


