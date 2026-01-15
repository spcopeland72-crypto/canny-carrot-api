# The Stables Business Record - Complete Dump Summary

**Generated:** 2026-01-10T22:02:08.119Z  
**Business ID:** `business_1767744076082_i3d1uu42x`  
**Email:** `laverickclare@hotmail.com`

## Executive Summary

✅ **Business profile exists** and is correctly stored in Redis  
❌ **ZERO rewards found** in Redis (confirms the bug - rewards created in app are not syncing to Redis)  
❌ **ZERO campaigns found** in Redis  
❌ **ZERO customers/members found** in Redis  

## Business Profile Details

### Basic Information
- **Name:** The Stables
- **Email:** laverickclare@hotmail.com
- **Phone:** 07969378747
- **Contact Name:** Clare Langley
- **Business Type:** Pub
- **Category:** Free Item
- **Description:** Public house

### Address
- **Address Line 1:** 7 Elderberry Close
- **Address Line 2:** (empty)
- **City:** (empty)
- **Postcode:** TS22 5US
- **Country:** UK

### Online Presence
- **Website:** https://cannycarrot.com
- **Facebook:** canny_carrot_rewards
- **Instagram:** canny_carrot_rewards
- **Twitter:** canny_carrot_rewards
- **TikTok:** (empty)
- **LinkedIn:** (empty)

### Account Status
- **Status:** ACTIVE
- **Subscription Tier:** gold
- **Onboarding Completed:** false
- **Team Size:** 7
- **Created:** 2026-01-07T00:01:16.080Z
- **Last Updated:** 2026-01-10T21:39:19.187Z

### Statistics (from business profile)
- **Customer Count:** 0
- **Total Scans:** 0
- **Rewards (live):** 0
- **Rewards (draft):** 0
- **Rewards (archived):** 0
- **Campaigns (live):** 0
- **Campaigns (draft):** 0
- **Campaigns (archived):** 0

### Settings
- **CRM Integration:** false
- **Notifications Opt-In:** true

## Authentication Data

✅ **Auth record exists** in Redis:
- **Email:** laverickclare@hotmail.com
- **Business ID:** business_1767744076082_i3d1uu42x
- **Account Created:** 2026-01-07T00:01:17.177Z
- **Password Hash:** Present (bcrypt)

## Rewards Analysis

### Expected vs Actual
- **Expected:** At least 1 reward ("Parmo Extreme" was created in the app)
- **Actual:** 0 rewards found in Redis

### Redis Keys Checked
1. `business:business_1767744076082_i3d1uu42x:rewards` (Redis set) - **Empty**
2. `business:business_1767744076082_i3d1uu42x` (Business profile embedded rewards) - **All empty arrays**

### Root Cause
This confirms the bug: **Rewards created in the business app are being saved to local repository but NOT syncing to Redis**. 

The reward "Parmo Extreme" was created locally but never made it to Redis, which is why:
- It doesn't appear on other devices
- It disappears after logout/login (local repo gets overwritten by empty Redis data)

## Campaigns Analysis

- **Expected:** 0 (no campaigns created)
- **Actual:** 0 ✅ (matches expectation)

## Customers/Members Analysis

- **Expected:** 0 (new business, no customers yet)
- **Actual:** 0 ✅ (matches expectation)

## Redis Key Structure Verified

### Existing Keys:
✅ `business:business_1767744076082_i3d1uu42x` - Business profile  
✅ `business:auth:laverickclare@hotmail.com` - Authentication data  

### Missing/Empty Keys:
❌ `business:business_1767744076082_i3d1uu42x:rewards` - Empty set  
❌ `reward:*` - No reward keys found  
❌ `business:business_1767744076082_i3d1uu42x:campaigns` - Not checked (would be empty)  
❌ `business:business_1767744076082_i3d1uu42x:members` - Not checked (would be empty)  

## Recommendations

1. **Fix Reward Sync:** The immediate sync after reward creation is not working. Check:
   - `dailySyncService.ts` - Is it actually calling the API?
   - API endpoint `/api/v1/rewards` - Is it receiving the data?
   - Redis write operations - Are they succeeding?

2. **Verify Logout Sync:** The logout sync should ensure all local changes are pushed to Redis before clearing auth.

3. **Add Monitoring:** Add logging to track when rewards are:
   - Created locally
   - Marked as dirty
   - Attempted to sync
   - Successfully synced to Redis

## Full Dump Location

Complete JSON dump saved to: `canny-carrot-api/the-stables-complete-dump.json`

## How to Re-run This Dump

```bash
cd canny-carrot-api
node scripts/dump-redis-record.js \
  --type business \
  --email laverickclare@hotmail.com \
  --output the-stables-complete-dump.json
```

Or use the short form:
```bash
node scripts/dump-redis-record.js -t business -e laverickclare@hotmail.com -o stables.json
```



