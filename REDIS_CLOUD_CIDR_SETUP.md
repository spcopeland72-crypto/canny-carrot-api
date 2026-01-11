# Redis Cloud CIDR Allow List Setup

## Location in Redis Cloud UI

1. **Log into Redis Cloud Dashboard**
2. Go to **"Databases"** (left sidebar)
3. **Click on your database name** (not the subscription)
4. Look for **"Edit Database"** button (usually top right)
5. Click **"Edit Database"**
6. Scroll to **"Security"** section
7. Find **"CIDR Allow List"** toggle/setting

## The Problem with Vercel

**Vercel uses dynamic IP addresses** - they change constantly. You cannot whitelist specific IPs.

## Solution Options

### Option 1: Disable CIDR Allow List (Recommended for Development)

1. In the **"CIDR Allow List"** section
2. **Toggle it OFF** or **leave it disabled**
3. This allows connections from anywhere (with password authentication)
4. Save changes

### Option 2: Allow All IPs (If You Must Enable CIDR)

If the CIDR Allow List is enabled and you can't disable it:

1. In the **"CIDR Allow List"** section
2. Add this CIDR range: **`0.0.0.0/0`**
3. This allows connections from all IP addresses
4. Save changes

⚠️ **Note:** This is safe because your Redis still requires password authentication (password is in the connection URL).

## Step-by-Step Instructions

### If You See "Edit Database" Button:

1. Click **"Edit Database"**
2. Find **"Security"** section (might be at the bottom)
3. Look for **"CIDR Allow List"** or **"IP Allow List"**
4. If it's **ON/Enabled**: Add `0.0.0.0/0` or disable it
5. If it's **OFF/Disabled**: Leave it as is (this is good!)
6. Click **"Save"** or **"Update"**

### If You Don't See "Edit Database":

The database might be in **read-only mode** or you might need different permissions. Try:

1. Check if you're the database owner/admin
2. Look for **"Settings"** or **"Configuration"** tab
3. Check subscription-level settings (might be inherited)

## Alternative: Check Database Status

While looking at your database, also check:

1. **Status** - Should be "Active" (not "Paused" or "Inactive")
2. **Endpoint** - Should show public endpoint URL
3. **Port** - Should match your connection URL (usually 15877)

## Testing After Changes

After updating the CIDR Allow List:

1. Wait 1-2 minutes for changes to propagate
2. Try a registration from the website
3. Check Vercel logs for:
   - "✅ Redis connection ready" (success)
   - "ETIMEDOUT" (still failing - try other options)

## If You Still Can't Find It

Tell me:
1. What version of Redis Cloud are you using? (Free, Fixed, Flexible)
2. What options/tabs do you see when clicking on your database?
3. Is there a "Security" or "Configuration" section visible?
4. Is the database status "Active"?

These details will help me give more specific instructions!



## Location in Redis Cloud UI

1. **Log into Redis Cloud Dashboard**
2. Go to **"Databases"** (left sidebar)
3. **Click on your database name** (not the subscription)
4. Look for **"Edit Database"** button (usually top right)
5. Click **"Edit Database"**
6. Scroll to **"Security"** section
7. Find **"CIDR Allow List"** toggle/setting

## The Problem with Vercel

**Vercel uses dynamic IP addresses** - they change constantly. You cannot whitelist specific IPs.

## Solution Options

### Option 1: Disable CIDR Allow List (Recommended for Development)

1. In the **"CIDR Allow List"** section
2. **Toggle it OFF** or **leave it disabled**
3. This allows connections from anywhere (with password authentication)
4. Save changes

### Option 2: Allow All IPs (If You Must Enable CIDR)

If the CIDR Allow List is enabled and you can't disable it:

1. In the **"CIDR Allow List"** section
2. Add this CIDR range: **`0.0.0.0/0`**
3. This allows connections from all IP addresses
4. Save changes

⚠️ **Note:** This is safe because your Redis still requires password authentication (password is in the connection URL).

## Step-by-Step Instructions

### If You See "Edit Database" Button:

1. Click **"Edit Database"**
2. Find **"Security"** section (might be at the bottom)
3. Look for **"CIDR Allow List"** or **"IP Allow List"**
4. If it's **ON/Enabled**: Add `0.0.0.0/0` or disable it
5. If it's **OFF/Disabled**: Leave it as is (this is good!)
6. Click **"Save"** or **"Update"**

### If You Don't See "Edit Database":

The database might be in **read-only mode** or you might need different permissions. Try:

1. Check if you're the database owner/admin
2. Look for **"Settings"** or **"Configuration"** tab
3. Check subscription-level settings (might be inherited)

## Alternative: Check Database Status

While looking at your database, also check:

1. **Status** - Should be "Active" (not "Paused" or "Inactive")
2. **Endpoint** - Should show public endpoint URL
3. **Port** - Should match your connection URL (usually 15877)

## Testing After Changes

After updating the CIDR Allow List:

1. Wait 1-2 minutes for changes to propagate
2. Try a registration from the website
3. Check Vercel logs for:
   - "✅ Redis connection ready" (success)
   - "ETIMEDOUT" (still failing - try other options)

## If You Still Can't Find It

Tell me:
1. What version of Redis Cloud are you using? (Free, Fixed, Flexible)
2. What options/tabs do you see when clicking on your database?
3. Is there a "Security" or "Configuration" section visible?
4. Is the database status "Active"?

These details will help me give more specific instructions!


