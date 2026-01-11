# API Server Deployment Steps

## Step 1: Create GitHub Repository

1. Go to: https://github.com/new
2. **Repository name:** `canny-carrot-api`
3. **Owner:** `spcopeland72-crypto`
4. **Description:** "Canny Carrot API Server - Redis proxy for all Canny Carrot apps"
5. **Visibility:** Private (recommended) or Public
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

## Step 2: Push Code to GitHub

```powershell
cd "C:\Canny Carrot\canny-carrot-api"

# Add remote (use the URL GitHub gives you)
git remote add origin https://github.com/spcopeland72-crypto/canny-carrot-api.git

# Commit all files
git add .
git commit -m "Initial commit: Canny Carrot API server with Redis proxy"

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

1. Go to: https://vercel.com/dashboard
2. Click "Add New Project"
3. Click "Import Git Repository"
4. Find and select: `spcopeland72-crypto/canny-carrot-api`
5. Click "Import"

### Configure Project:
- **Project Name:** `canny-carrot-api`
- **Framework Preset:** Other
- **Root Directory:** `./` (default)
- **Build Command:** `npm run build`
- **Output Directory:** Leave empty (serverless functions don't need output)
- **Install Command:** `npm install`

### Add Environment Variables:
Click "Environment Variables" and add:

```
NODE_ENV=production
```

```
REDIS_URL=redis://default:9dVAwjHBBYVACe68zaMZ68MYppVhtFFX@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877
```

```
PORT=3001
```
**Note:** PORT is optional for Vercel serverless functions (only needed for local dev)

```
CORS_ORIGINS=https://cannycarrot.com,https://www.cannycarrot.com
```

For each variable:
- Select all environments (Production, Preview, Development)
- Click "Save"

6. Click "Deploy"

## Step 4: Add Domain

After deployment succeeds:

1. Go to: **Settings** → **Domains**
2. Click **"Add Domain"**
3. Enter: `api.cannycarrot.com`
4. Click **"Add"**
5. Follow DNS instructions (you already created the DNS record)
6. Wait for verification (status changes from "Pending" to "Valid")

## Step 5: Verify Deployment

```powershell
# Test API root
Invoke-RestMethod -Uri 'https://api.cannycarrot.com/'

# Test health check
Invoke-RestMethod -Uri 'https://api.cannycarrot.com/health'

# Test Redis proxy
$body = @{args=@('businesses:all')} | ConvertTo-Json
Invoke-RestMethod -Uri 'https://api.cannycarrot.com/api/v1/redis/smembers' -Method Post -Body $body -ContentType 'application/json'
```

All should return JSON (not 404 errors).

## Step 6: Update Signup Website Environment Variable

1. Go to Vercel Dashboard → `cannycarrot.com` project
2. **Settings** → **Environment Variables**
3. Click **"Add New"**
4. **Key:** `CANNY_CARROT_API_URL`
5. **Value:** `https://api.cannycarrot.com`
6. Select all environments (Production, Preview, Development)
7. Click **"Save"**
8. Go to **Deployments** tab
9. Click three dots (⋯) on latest deployment
10. Click **"Redeploy"**

## Step 7: Test Production Registration

1. Go to: https://cannycarrot.com/register?type=business
2. Fill out and submit registration form
3. Check browser console (F12) - should see no errors
4. Verify business appears in Redis via API
5. Check admin app - business should appear

## Troubleshooting

### Build Fails?
- Check build logs in Vercel
- Ensure TypeScript compiles: `npm run build` works locally
- Check all environment variables are set

### Domain Not Working?
- Wait 5-60 minutes for DNS propagation
- Verify DNS record matches Vercel instructions
- Check domain status in Vercel shows "Valid" not "Pending"

### Redis Connection Fails?
- Verify REDIS_URL is correct
- Check Redis Cloud allows connections from Vercel IPs
- Check Vercel function logs for Redis errors

### Registration Still Not Working?
- Verify `CANNY_CARROT_API_URL` is set in signup website Vercel project
- Check signup website is redeployed after adding env var
- Check browser console for API call errors
- Verify API is accessible: `https://api.cannycarrot.com/health`


## Step 1: Create GitHub Repository

1. Go to: https://github.com/new
2. **Repository name:** `canny-carrot-api`
3. **Owner:** `spcopeland72-crypto`
4. **Description:** "Canny Carrot API Server - Redis proxy for all Canny Carrot apps"
5. **Visibility:** Private (recommended) or Public
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

## Step 2: Push Code to GitHub

```powershell
cd "C:\Canny Carrot\canny-carrot-api"

# Add remote (use the URL GitHub gives you)
git remote add origin https://github.com/spcopeland72-crypto/canny-carrot-api.git

# Commit all files
git add .
git commit -m "Initial commit: Canny Carrot API server with Redis proxy"

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

1. Go to: https://vercel.com/dashboard
2. Click "Add New Project"
3. Click "Import Git Repository"
4. Find and select: `spcopeland72-crypto/canny-carrot-api`
5. Click "Import"

### Configure Project:
- **Project Name:** `canny-carrot-api`
- **Framework Preset:** Other
- **Root Directory:** `./` (default)
- **Build Command:** `npm run build`
- **Output Directory:** Leave empty (serverless functions don't need output)
- **Install Command:** `npm install`

### Add Environment Variables:
Click "Environment Variables" and add:

```
NODE_ENV=production
```

```
REDIS_URL=redis://default:9dVAwjHBBYVACe68zaMZ68MYppVhtFFX@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877
```

```
PORT=3001
```
**Note:** PORT is optional for Vercel serverless functions (only needed for local dev)

```
CORS_ORIGINS=https://cannycarrot.com,https://www.cannycarrot.com
```

For each variable:
- Select all environments (Production, Preview, Development)
- Click "Save"

6. Click "Deploy"

## Step 4: Add Domain

After deployment succeeds:

1. Go to: **Settings** → **Domains**
2. Click **"Add Domain"**
3. Enter: `api.cannycarrot.com`
4. Click **"Add"**
5. Follow DNS instructions (you already created the DNS record)
6. Wait for verification (status changes from "Pending" to "Valid")

## Step 5: Verify Deployment

```powershell
# Test API root
Invoke-RestMethod -Uri 'https://api.cannycarrot.com/'

# Test health check
Invoke-RestMethod -Uri 'https://api.cannycarrot.com/health'

# Test Redis proxy
$body = @{args=@('businesses:all')} | ConvertTo-Json
Invoke-RestMethod -Uri 'https://api.cannycarrot.com/api/v1/redis/smembers' -Method Post -Body $body -ContentType 'application/json'
```

All should return JSON (not 404 errors).

## Step 6: Update Signup Website Environment Variable

1. Go to Vercel Dashboard → `cannycarrot.com` project
2. **Settings** → **Environment Variables**
3. Click **"Add New"**
4. **Key:** `CANNY_CARROT_API_URL`
5. **Value:** `https://api.cannycarrot.com`
6. Select all environments (Production, Preview, Development)
7. Click **"Save"**
8. Go to **Deployments** tab
9. Click three dots (⋯) on latest deployment
10. Click **"Redeploy"**

## Step 7: Test Production Registration

1. Go to: https://cannycarrot.com/register?type=business
2. Fill out and submit registration form
3. Check browser console (F12) - should see no errors
4. Verify business appears in Redis via API
5. Check admin app - business should appear

## Troubleshooting

### Build Fails?
- Check build logs in Vercel
- Ensure TypeScript compiles: `npm run build` works locally
- Check all environment variables are set

### Domain Not Working?
- Wait 5-60 minutes for DNS propagation
- Verify DNS record matches Vercel instructions
- Check domain status in Vercel shows "Valid" not "Pending"

### Redis Connection Fails?
- Verify REDIS_URL is correct
- Check Redis Cloud allows connections from Vercel IPs
- Check Vercel function logs for Redis errors

### Registration Still Not Working?
- Verify `CANNY_CARROT_API_URL` is set in signup website Vercel project
- Check signup website is redeployed after adding env var
- Check browser console for API call errors
- Verify API is accessible: `https://api.cannycarrot.com/health`

