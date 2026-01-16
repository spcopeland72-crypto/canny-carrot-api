# Field Mapping: Forms vs API Expected Fields

This document maps all form-collected fields against API expected fields to identify missing fields and data loss sources.

## Business Profile

### Form Fields (BusinessProfilePage.tsx)
**Collected Fields:**
- `name` - Business name (required)
- `email` - Business email (required)
- `phone` - Business phone (required)
- `address` / `addressLine1` - Business address
- `logo` - Business logo (base64 or URI)
- `logoIcon` - Circular icon version (generated)

**NOT Collected by Form:**
- `products` - Array of product names
- `actions` - Array of action names
- `addressLine2`, `city`, `postcode`, `country` - Address components (only `address` collected)
- `website`, `socialMedia` - Not in form
- `description`, `category`, `companyNumber` - Not in form

### Save Logic (BusinessProfilePage.tsx:249-260)
```typescript
const updatedProfile: BusinessProfile = {
  id: businessId,
  name: businessName,
  email: email,
  phone: phone,
  address: address,
  logo: logo || undefined,
  logoIcon: logoIcon || undefined,
  ...existingProfile, // Preserves products/actions from existing profile
  updatedAt: new Date().toISOString(),
  createdAt: existingProfile?.createdAt || new Date().toISOString(),
};
```

**Analysis:**
- Form preserves `products` and `actions` via `...existingProfile` spread (LOCALLY)
- BUT when `businessRepository.save()` sends to API, it sends `updatedProfile` which should include products/actions
- **ROOT CAUSE:** API does full replacement `{...updates}`, so if the profile sent doesn't have products (shouldn't happen if spread works), they're lost

### API Expected Fields (Business PUT)
**Expected (from existing data):**
- `products` - Array (should always be present, even if empty)
- `profile.products` - Nested products (may also exist)

**Issue:** Form doesn't collect `products`, so they're missing when business profile is saved, causing data loss.

---

## Rewards

### Form Fields (CreateEditRewardPage.tsx)
**Collected Fields:**
- `name` - Reward name (required)
- `requirement` / `stampsRequired` - Stamps required (required for rewards, not campaigns)
- `pointsPerPurchase` - Points per purchase (required)
- `pinCode` - 4-digit PIN (required)
- `type` - 'product' or 'action' (required)
- `rewardType` - 'free_product', 'discount', or 'other' (required)
- `selectedProducts` - Array of product IDs (if type === 'product')
- `selectedActions` - Array of action names (if type === 'action')
- `customTypeText` - Custom type text (if rewardType === 'other')

**Generated Fields:**
- `id` - Generated ID (timestamp + random)
- `qrCode` - Generated QR code string
- `businessId` - From auth
- `description` - Empty string
- `type` - Mapped from rewardType ('freebie', 'discount')
- `isActive` - Always true
- `validFrom` - Current timestamp
- `createdAt` - Current timestamp (on create)
- `updatedAt` - Current timestamp
- `currentRedemptions` - Always 0
- `costStamps` - Same as stampsRequired

### API Expected Fields (Rewards POST)
**Expected (from existing data):**
- `pinCode` - Should always be present (required by form)
- `qrCode` - Should always be present (generated)
- `selectedProducts` - Should be present if type === 'product'
- `selectedActions` - Should be present if type === 'action'

**Status:** ✅ All fields collected by form are included in saved object.

---

## Campaigns

### Form Fields (CreateEditRewardPage.tsx - isCampaign mode)
**Collected Fields:**
- `name` - Campaign name (required)
- `pointsPerPurchase` - Points per purchase (required)
- `pinCode` - 4-digit PIN (required)
- `type` - 'product' or 'action' (required)
- `rewardType` - 'free_product', 'discount', or 'other' (required)
- `selectedProducts` - Array of product IDs (if type === 'product')
- `selectedActions` - Array of action names (if type === 'action')
- `customTypeText` - Custom type text (if rewardType === 'other')

**Preserved from Existing (on edit):**
- `description` - From existing campaign
- `startDate` - From existing campaign
- `endDate` - From existing campaign
- `status` - From existing campaign
- `targetAudience` - From existing campaign
- `createdAt` - From existing campaign
- `stats` - From existing campaign

**Generated/Default Fields:**
- `id` - Generated ID (timestamp + random) or existing
- `businessId` - From auth
- `type` - Campaign type (default: 'bonus_reward')
- `startDate` - Current timestamp (on create)
- `endDate` - 1 year from now (on create)
- `status` - 'active' (on create)
- `targetAudience` - 'all' (on create)
- `stats` - { impressions: 0, clicks: 0, conversions: 0 } (on create)
- `conditions` - Object containing `rewardData`:
  - `selectedProducts` - From form
  - `selectedActions` - From form
  - `pinCode` - From form
  - `qrCode` - Generated
  - `stampsRequired` - Always 1 (hardcoded)
  - `pointsPerPurchase` - From form
  - `rewardType` - From form

### API Expected Fields (Campaigns POST)
**Expected (from existing data):**
- `conditions` - Should always be present (object)
- `conditions.rewardData` - Should always be present (object with reward fields)
- `conditions.rewardData.selectedProducts` - Should be present if type === 'product'
- `conditions.rewardData.selectedActions` - Should be present if type === 'action'
- `conditions.rewardData.pinCode` - Should always be present
- `conditions.rewardData.qrCode` - Should always be present

**Status:** ✅ All fields collected by form are included in saved object.

---

## Products

### Form Fields
**Status:** ❌ **NO FORM EXISTS FOR PRODUCTS**

Products are managed through the business profile form but there's no dedicated product creation form. Products are added as strings to the `products` array in the business profile.

**How Products are Added:**
- Products are added via business profile management
- Stored as array of strings: `products: ["Product 1", "Product 2", ...]`

### API Expected Fields
**Expected:**
- `products` - Array of product names (strings)

**Issue:** Products are not collected by business profile form, so they're lost when business profile is saved.

---

## Actions

### Form Fields
**Status:** ❌ **NO FORM EXISTS FOR ACTIONS**

Actions are managed through the business profile but there's no dedicated action creation form. Actions are predefined or added to the `actions` array in the business profile.

**Default Actions:**
- 'Write a Review'
- 'Share on Facebook'
- 'Share on Instagram'
- 'Share on TikTok'
- 'Share on X (Twitter)'
- 'Share on LinkedIn'
- 'Check In'
- 'Follow Business'
- 'Post Mentioning Business'

### API Expected Fields
**Expected:**
- `actions` - Array of action names (strings)

**Issue:** Actions are not collected by business profile form, so they're lost when business profile is saved.

---

## Customer Accounts

### Form Fields
**Status:** ⚠️ **NEEDS VERIFICATION**

Customer accounts are created in the customer app. Need to check customer app forms.

---

## Summary of Data Loss Sources

### Critical Issues:

1. **Business Profile - Products Missing**
   - Form doesn't collect `products` array
   - API expects `products` to always be present
   - **Result:** Products lost on every business profile save

2. **Business Profile - Actions Missing**
   - Form doesn't collect `actions` array
   - API expects `actions` to always be present
   - **Result:** Actions lost on every business profile save

3. **Business Profile - Address Fields**
   - Form only collects single `address` field
   - API may expect `addressLine1`, `addressLine2`, `city`, `postcode`, `country`
   - **Status:** May cause data loss if existing data has structured address

4. **Campaigns - Conditions Structure**
   - Form correctly includes `conditions.rewardData`
   - **Status:** ✅ No issues if form is sending complete data

5. **Rewards - All Fields Present**
   - Form collects all required fields
   - **Status:** ✅ No issues

---

## Recommendations

1. **Business Profile Form:**
   - Add `products` array management (add/remove products)
   - Add `actions` array management (add/remove actions)
   - Preserve `products` and `actions` when saving profile
   - Add structured address fields (addressLine1, addressLine2, city, postcode, country)

2. **API Validation:**
   - Flag missing `products` when business profile is saved
   - Flag missing `actions` when business profile is saved
   - Log warnings for all missing expected fields

3. **Data Integrity:**
   - Load existing `products` and `actions` when opening business profile form
   - Merge with form data before saving
   - Never send incomplete business profile to API

