# Required Fields Mismatch: API vs Forms

This document lists all "required fields" defined in API validation that don't match the form data actually collected.

## Business Profile

### API Required Fields (businesses.ts:40)
```typescript
if (!name || !email || !address) {
  throw new ApiError(400, 'Name, email, and address are required');
}
```
**API Requires:**
- `name` ✅ (collected by form)
- `email` ✅ (collected by form)
- `address` ⚠️ **ISSUE:** API requires `address`, but form only collects `address` (not structured)

### Form Collected Fields (BusinessProfilePage.tsx:237-260)
**Form Collects:**
- `name` ✅ (required by form: line 238)
- `email` ✅ (required by form: line 238)
- `phone` - Optional in form
- `address` ✅ (collected, but API expects structured address?)
- `logo` - Optional
- `logoIcon` - Optional

**Mismatch:**
- ❌ **API requires `address`** - Form collects it, but API validation may expect structured address object
- ⚠️ API POST endpoint checks for `address` object structure, but form sends string

---

## Rewards

### API Required Fields (rewards.ts:70-73)
```typescript
if (!businessId || !name || !stampsRequired) {
  console.error('❌ [REWARDS] Missing required fields:', { businessId: !!businessId, name: !!name, stampsRequired: !!stampsRequired });
  throw new ApiError(400, 'Business ID, name, and stamps required are mandatory');
}
```
**API Requires:**
- `businessId` ✅ (from auth, not form)
- `name` ✅ (collected by form)
- `stampsRequired` ✅ (collected by form as `requirement`)

### Form Collected Fields (CreateEditRewardPage.tsx:310-326)
**Form Collects:**
- `name` ✅ (required: line 312)
- `requirement` / `stampsRequired` ✅ (required for rewards: line 317)
- `pointsPerPurchase` ✅ (required: line 312)
- `pinCode` ✅ (required: line 323 - must be 4 digits)
- `type` ✅ (required - 'product' or 'action')
- `rewardType` ✅ (required - 'free_product', 'discount', or 'other')
- `selectedProducts` - Conditional (if type === 'product')
- `selectedActions` - Conditional (if type === 'action')

**Mismatch:**
- ✅ **NO MISMATCH** - All API required fields are collected by form

**Note:** Form requires MORE fields than API validates:
- `pointsPerPurchase` - Required by form, not validated by API
- `pinCode` - Required by form, not validated by API

---

## Campaigns

### API Required Fields (campaigns.ts:102-105)
```typescript
if (!businessId || !name) {
  console.error('❌ [CAMPAIGNS] Missing required fields:', { businessId: !!businessId, name: !!name });
  throw new ApiError(400, 'Business ID and name are mandatory');
}
```
**API Requires:**
- `businessId` ✅ (from auth, not form)
- `name` ✅ (collected by form)

### Form Collected Fields (CreateEditRewardPage.tsx:310-326, isCampaign mode)
**Form Collects (for campaigns):**
- `name` ✅ (required: line 312)
- `pointsPerPurchase` ✅ (required: line 312)
- `pinCode` ✅ (required: line 323 - must be 4 digits)
- `type` ✅ (required - 'product' or 'action')
- `rewardType` ✅ (required - 'free_product', 'discount', or 'other')
- `selectedProducts` - Conditional (if type === 'product')
- `selectedActions` - Conditional (if type === 'action')

**Mismatch:**
- ✅ **NO MISMATCH** - All API required fields are collected by form

**Note:** Form requires MORE fields than API validates:
- `pointsPerPurchase` - Required by form, not validated by API
- `pinCode` - Required by form, not validated by API
- `type` - Required by form, not validated by API
- `rewardType` - Required by form, not validated by API

**Campaign Structure Issue:**
- Form sends campaign with `conditions.rewardData` structure
- API validates only `name` and `businessId`
- API doesn't validate that campaign has valid `conditions.rewardData` structure

---

## Summary of Mismatches

### Critical Mismatches (API requires but form doesn't collect):

1. **Business Profile - Address Structure**
   - ❌ **API expects:** Structured `address` object (based on validation logic)
   - ⚠️ **Form sends:** String `address` field
   - **Location:** `businesses.ts:40` vs `BusinessProfilePage.tsx:254`

### Missing API Validations (Form requires but API doesn't validate):

1. **Rewards - Missing Validations:**
   - `pointsPerPurchase` - Required by form, not validated by API
   - `pinCode` - Required by form (4 digits), not validated by API
   - `type` - Required by form, not validated by API
   - `rewardType` - Required by form, not validated by API

2. **Campaigns - Missing Validations:**
   - `pointsPerPurchase` - Required by form, not validated by API
   - `pinCode` - Required by form (4 digits), not validated by API
   - `type` - Required by form, not validated by API
   - `rewardType` - Required by form, not validated by API
   - `conditions.rewardData` - Required structure by form, not validated by API

### Issues Identified:

1. **Business Address:**
   - API validation checks for `address` but may expect structured object
   - Form only collects string `address`
   - **Fix needed:** Either update API to accept string OR update form to collect structured address

2. **Rewards/Campaigns Over-Validation:**
   - Form requires more fields than API validates
   - If form validation passes but data structure is wrong, API won't catch it
   - **Fix needed:** API should validate all fields that form requires OR form validation should be sufficient

3. **Campaign Structure:**
   - Form sends complex `conditions.rewardData` structure
   - API only validates `name` and `businessId`
   - **Fix needed:** API should validate campaign structure matches form expectations

---

## Recommendations

1. **Business Address:**
   - Update API to accept either string `address` OR structured address object
   - OR update form to collect structured address fields (addressLine1, addressLine2, city, postcode, country)

2. **Rewards/Campaigns:**
   - Add API validation for `pointsPerPurchase`, `pinCode`, `type`, `rewardType` to match form requirements
   - OR remove form validation if API validation is sufficient

3. **Campaign Structure:**
   - Add API validation for `conditions.rewardData` structure when campaign is created/updated
   - Validate that `conditions.rewardData` contains required fields: `pinCode`, `qrCode`, `stampsRequired`, `pointsPerPurchase`

