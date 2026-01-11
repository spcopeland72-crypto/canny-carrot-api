# Environment Variables for Canny Carrot API

## Required for Production

These environment variables MUST be set in Vercel for the API to work:

### Minimum Required (Basic Functionality)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `NODE_ENV` | `production` | ✅ Yes | Environment mode |
| `REDIS_URL` | `redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877` | ✅ Yes | **CRITICAL** - Redis connection string (format: `redis://username:password@host:port`) |
| `CORS_ORIGINS` | `https://cannycarrot.com,https://www.cannycarrot.com` | ✅ Yes | Comma-separated list of allowed origins |
| `JWT_SECRET` | `<generate-strong-random-secret>` | ✅ Yes | Must be changed from default - use `openssl rand -hex 32` |

**Note:** `PORT` is NOT needed for Vercel serverless functions. Vercel handles routing automatically. PORT is only used for local development or traditional server deployments.

---

## Optional / Feature-Specific Variables

### API Configuration

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `API_BASE_URL` | `https://api.cannycarrot.com` | ❌ No | Used for webhook registration and self-referencing |

### JWT Authentication

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `JWT_EXPIRES_IN` | `7d` | ❌ No | Token expiration time (default: 7d) |

### Stripe Payment Processing (If using Stripe)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` | ❌ No | Stripe API secret key (NOT FOUND - need to add) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_51ScwkeDHSurbVejhGnt9ePMBcN2fJFlmrWV324cPXH5axBub0KyRlu3PnsjfeVnnTD0XSWTPMaUchZSx3IZ27oEK00vX5UUqwJ` | ❌ No | Stripe publishable key (FOUND in thread records) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | ❌ No | Stripe webhook secret (NOT FOUND - need to add) |

### Shopify Integration (If using Shopify)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `SHOPIFY_CLIENT_ID` | `<your_shopify_client_id>` | ❌ No | Shopify app client ID |
| `SHOPIFY_CLIENT_SECRET` | `<your_shopify_client_secret>` | ❌ No | Shopify app client secret |
| `SHOPIFY_REDIRECT_URI` | `https://api.cannycarrot.com/api/v1/integrations/shopify/callback` | ❌ No | OAuth redirect URI |

### WooCommerce Integration (If using WooCommerce)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `WOOCOMMERCE_WEBHOOK_SECRET` | `<your_woocommerce_webhook_secret>` | ❌ No | WooCommerce webhook secret |

### eBay Integration (If using eBay)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `EBAY_CLIENT_ID` | `<your_ebay_client_id>` | ❌ No | eBay application client ID |
| `EBAY_CLIENT_SECRET` | `<your_ebay_client_secret>` | ❌ No | eBay application client secret |
| `EBAY_REDIRECT_URI` | `https://api.cannycarrot.com/api/v1/integrations/ebay/callback` | ❌ No | OAuth redirect URI |
| `EBAY_RU_NAME` | `<your_ebay_ru_name>` | ❌ No | eBay Redirect URI Name (required for OAuth) |

### Etsy Integration (If using Etsy)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `ETSY_CLIENT_ID` | `<your_etsy_client_id>` | ❌ No | Etsy application client ID |
| `ETSY_REDIRECT_URI` | `https://api.cannycarrot.com/api/v1/integrations/etsy/callback` | ❌ No | OAuth redirect URI |

### Amazon Integration (If using Amazon)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `AMAZON_SELLER_ID` | `<your_amazon_seller_id>` | ❌ No | Amazon seller ID |
| `AMAZON_MWS_ACCESS_KEY` | `<your_amazon_mws_access_key>` | ❌ No | Amazon MWS access key |
| `AMAZON_MWS_SECRET_KEY` | `<your_amazon_mws_secret_key>` | ❌ No | Amazon MWS secret key |
| `AMAZON_SP_API_CLIENT_ID` | `<your_amazon_sp_api_client_id>` | ❌ No | Amazon SP API client ID |
| `AMAZON_SP_API_CLIENT_SECRET` | `<your_amazon_sp_api_client_secret>` | ❌ No | Amazon SP API client secret |
| `AMAZON_SP_API_REFRESH_TOKEN` | `<your_amazon_sp_api_refresh_token>` | ❌ No | Amazon SP API refresh token |
| `AMAZON_MARKETPLACE_ID` | `A1F83G8C2ARO7P` | ❌ No | UK marketplace (default) |
| `AMAZON_REDIRECT_URI` | `https://api.cannycarrot.com/api/v1/integrations/amazon/callback` | ❌ No | OAuth redirect URI |

### BID (Business Improvement District) API Keys (If using BID features)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `BID_MIDDLESBROUGH_KEY` | `<your_middlesbrough_key>` | ❌ No | Middlesbrough BID API key |
| `BID_STOCKTON_KEY` | `<your_stockton_key>` | ❌ No | Stockton BID API key |
| `BID_DARLINGTON_KEY` | `<your_darlington_key>` | ❌ No | Darlington BID API key |

### Tees Valley Combined Authority (If using TVCA integration)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `TVCA_API_KEY` | `<your_tvca_api_key>` | ❌ No | TVCA API key |
| `TVCA_REPORTING_ENDPOINT` | `https://api.tvca.gov.uk/reporting` | ❌ No | TVCA reporting endpoint |

---

## How to Set in Vercel

1. Go to Vercel Dashboard → Your API Project
2. **Settings** → **Environment Variables**
3. For each variable:
   - Click **"Add New"**
   - Enter the **Key** (variable name from table above)
   - Enter the **Value** (from table above, or your actual value)
   - Select environments: **Production**, **Preview**, **Development** (check all)
   - Click **"Save"**
4. After adding all variables, go to **Deployments** tab
5. Click three dots (⋯) on latest deployment
6. Click **"Redeploy"** to apply the new environment variables

---

## Quick Copy-Paste for Minimum Setup

Copy these into Vercel:

```
NODE_ENV=production
REDIS_URL=redis://default:9dVAwjHBBYVACe68zaMZ68MYppVhtFFX@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877
CORS_ORIGINS=https://cannycarrot.com,https://www.cannycarrot.com
JWT_SECRET=<generate-a-strong-random-secret-here>
```

**To generate JWT_SECRET:**
```bash
# On Windows PowerShell:
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# On Linux/Mac:
openssl rand -hex 32
```

---

## Security Notes

- ⚠️ **Never commit secrets to Git** (already handled - secrets removed from code)
- ⚠️ **Use different secrets for production vs development**
- ⚠️ **Generate strong random secrets** for JWT_SECRET
- ⚠️ **REDIS_URL contains a password** - keep it secure
- ✅ All secrets are read from environment variables (no hardcoded values)

---

## Testing Environment Variables

After deployment, test that variables are working:

```powershell
# Test API is running
Invoke-RestMethod -Uri 'https://api.cannycarrot.com/health'

# Should return Redis status (should be "connected" if REDIS_URL is correct)
```

## Required for Production

These environment variables MUST be set in Vercel for the API to work:

### Minimum Required (Basic Functionality)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `NODE_ENV` | `production` | ✅ Yes | Environment mode |
| `REDIS_URL` | `redis://canny-carrot:ccRewards99!@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877` | ✅ Yes | **CRITICAL** - Redis connection string (format: `redis://username:password@host:port`) |
| `CORS_ORIGINS` | `https://cannycarrot.com,https://www.cannycarrot.com` | ✅ Yes | Comma-separated list of allowed origins |
| `JWT_SECRET` | `<generate-strong-random-secret>` | ✅ Yes | Must be changed from default - use `openssl rand -hex 32` |

**Note:** `PORT` is NOT needed for Vercel serverless functions. Vercel handles routing automatically. PORT is only used for local development or traditional server deployments.

---

## Optional / Feature-Specific Variables

### API Configuration

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `API_BASE_URL` | `https://api.cannycarrot.com` | ❌ No | Used for webhook registration and self-referencing |

### JWT Authentication

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `JWT_EXPIRES_IN` | `7d` | ❌ No | Token expiration time (default: 7d) |

### Stripe Payment Processing (If using Stripe)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` | ❌ No | Stripe API secret key (NOT FOUND - need to add) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_51ScwkeDHSurbVejhGnt9ePMBcN2fJFlmrWV324cPXH5axBub0KyRlu3PnsjfeVnnTD0XSWTPMaUchZSx3IZ27oEK00vX5UUqwJ` | ❌ No | Stripe publishable key (FOUND in thread records) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | ❌ No | Stripe webhook secret (NOT FOUND - need to add) |

### Shopify Integration (If using Shopify)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `SHOPIFY_CLIENT_ID` | `<your_shopify_client_id>` | ❌ No | Shopify app client ID |
| `SHOPIFY_CLIENT_SECRET` | `<your_shopify_client_secret>` | ❌ No | Shopify app client secret |
| `SHOPIFY_REDIRECT_URI` | `https://api.cannycarrot.com/api/v1/integrations/shopify/callback` | ❌ No | OAuth redirect URI |

### WooCommerce Integration (If using WooCommerce)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `WOOCOMMERCE_WEBHOOK_SECRET` | `<your_woocommerce_webhook_secret>` | ❌ No | WooCommerce webhook secret |

### eBay Integration (If using eBay)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `EBAY_CLIENT_ID` | `<your_ebay_client_id>` | ❌ No | eBay application client ID |
| `EBAY_CLIENT_SECRET` | `<your_ebay_client_secret>` | ❌ No | eBay application client secret |
| `EBAY_REDIRECT_URI` | `https://api.cannycarrot.com/api/v1/integrations/ebay/callback` | ❌ No | OAuth redirect URI |
| `EBAY_RU_NAME` | `<your_ebay_ru_name>` | ❌ No | eBay Redirect URI Name (required for OAuth) |

### Etsy Integration (If using Etsy)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `ETSY_CLIENT_ID` | `<your_etsy_client_id>` | ❌ No | Etsy application client ID |
| `ETSY_REDIRECT_URI` | `https://api.cannycarrot.com/api/v1/integrations/etsy/callback` | ❌ No | OAuth redirect URI |

### Amazon Integration (If using Amazon)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `AMAZON_SELLER_ID` | `<your_amazon_seller_id>` | ❌ No | Amazon seller ID |
| `AMAZON_MWS_ACCESS_KEY` | `<your_amazon_mws_access_key>` | ❌ No | Amazon MWS access key |
| `AMAZON_MWS_SECRET_KEY` | `<your_amazon_mws_secret_key>` | ❌ No | Amazon MWS secret key |
| `AMAZON_SP_API_CLIENT_ID` | `<your_amazon_sp_api_client_id>` | ❌ No | Amazon SP API client ID |
| `AMAZON_SP_API_CLIENT_SECRET` | `<your_amazon_sp_api_client_secret>` | ❌ No | Amazon SP API client secret |
| `AMAZON_SP_API_REFRESH_TOKEN` | `<your_amazon_sp_api_refresh_token>` | ❌ No | Amazon SP API refresh token |
| `AMAZON_MARKETPLACE_ID` | `A1F83G8C2ARO7P` | ❌ No | UK marketplace (default) |
| `AMAZON_REDIRECT_URI` | `https://api.cannycarrot.com/api/v1/integrations/amazon/callback` | ❌ No | OAuth redirect URI |

### BID (Business Improvement District) API Keys (If using BID features)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `BID_MIDDLESBROUGH_KEY` | `<your_middlesbrough_key>` | ❌ No | Middlesbrough BID API key |
| `BID_STOCKTON_KEY` | `<your_stockton_key>` | ❌ No | Stockton BID API key |
| `BID_DARLINGTON_KEY` | `<your_darlington_key>` | ❌ No | Darlington BID API key |

### Tees Valley Combined Authority (If using TVCA integration)

| Key | Value | Required | Notes |
|-----|-------|----------|-------|
| `TVCA_API_KEY` | `<your_tvca_api_key>` | ❌ No | TVCA API key |
| `TVCA_REPORTING_ENDPOINT` | `https://api.tvca.gov.uk/reporting` | ❌ No | TVCA reporting endpoint |

---

## How to Set in Vercel

1. Go to Vercel Dashboard → Your API Project
2. **Settings** → **Environment Variables**
3. For each variable:
   - Click **"Add New"**
   - Enter the **Key** (variable name from table above)
   - Enter the **Value** (from table above, or your actual value)
   - Select environments: **Production**, **Preview**, **Development** (check all)
   - Click **"Save"**
4. After adding all variables, go to **Deployments** tab
5. Click three dots (⋯) on latest deployment
6. Click **"Redeploy"** to apply the new environment variables

---

## Quick Copy-Paste for Minimum Setup

Copy these into Vercel:

```
NODE_ENV=production
REDIS_URL=redis://default:9dVAwjHBBYVACe68zaMZ68MYppVhtFFX@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877
CORS_ORIGINS=https://cannycarrot.com,https://www.cannycarrot.com
JWT_SECRET=<generate-a-strong-random-secret-here>
```

**To generate JWT_SECRET:**
```bash
# On Windows PowerShell:
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# On Linux/Mac:
openssl rand -hex 32
```

---

## Security Notes

- ⚠️ **Never commit secrets to Git** (already handled - secrets removed from code)
- ⚠️ **Use different secrets for production vs development**
- ⚠️ **Generate strong random secrets** for JWT_SECRET
- ⚠️ **REDIS_URL contains a password** - keep it secure
- ✅ All secrets are read from environment variables (no hardcoded values)

---

## Testing Environment Variables

After deployment, test that variables are working:

```powershell
# Test API is running
Invoke-RestMethod -Uri 'https://api.cannycarrot.com/health'

# Should return Redis status (should be "connected" if REDIS_URL is correct)
```
