# Deploy Canny Carrot API to Vercel

## Step 1: Create GitHub Repository

1. **Go to GitHub:**
   - https://github.com/new
   - Or use GitHub Desktop/CLI

2. **Create New Repository:**
   - Repository name: `canny-carrot-api`
   - Description: "Canny Carrot Loyalty Platform API - Powering Tees Valley's Local Business Rewards"
   - Visibility: Private (recommended) or Public
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)

3. **Push Code to GitHub:**
   ```bash
   cd "C:\Canny Carrot\canny-carrot-api"
   git init
   git add .
   git commit -m "Initial commit: Canny Carrot API"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/canny-carrot-api.git
   git push -u origin main
   ```

## Step 2: Create Vercel Project

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard

2. **Click "Add New Project"**

3. **Import from GitHub:**
   - Select "Import Git Repository"
   - Find and select: `YOUR_USERNAME/canny-carrot-api`
   - Click "Import"

4. **Configure Project:**
   - **Project Name:** `canny-carrot-api`
   - **Framework Preset:** Other (or Express.js if available)
   - **Root Directory:** `./` (leave as default)
   - **Build Command:** `npm run build` (or leave empty - Vercel will auto-detect)
   - **Output Directory:** Leave empty (serverless functions don't need output)
   - **Install Command:** `npm install`

5. **Click "Deploy"** (we'll add environment variables next)

## Step 3: Add Environment Variables

**After the first deployment (even if it fails), add these environment variables:**

1. **Go to Project Settings → Environment Variables**

2. **Add Each Variable:**

   ```
   NODE_ENV=production
   ```

   ```
   REDIS_URL=redis://default:9dVAwjHBBYVACe68zaMZ68MYppVhtFFX@redis-15877.crce204.eu-west-2-3.ec2.cloud.redislabs.com:15877
   ```

   ```
   PORT=3001
   ```

   ```
   JWT_SECRET=<generate-a-strong-random-secret>
   ```

   ```
   API_BASE_URL=https://api.cannycarrot.com
   ```

   ```
   CORS_ORIGINS=https://app.cannycarrot.com,https://admin.cannycarrot.com,https://business.cannycarrot.com
   ```

   ```
   STRIPE_SECRET_KEY=<your-stripe-secret-key>
   ```

   ```
   STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
   ```

3. **Select Environments:**
   - Check all: Production, Preview, Development
   - Click "Save" for each variable

4. **Redeploy:**
   - Go to "Deployments" tab
   - Click the three dots (⋯) on the latest deployment
   - Click "Redeploy"

## Step 4: Add Domain (api.cannycarrot.com)

1. **Go to Project Settings → Domains**

2. **Add Domain:**
   - Click "Add Domain"
   - Enter: `api.cannycarrot.com`
   - Click "Add"

3. **Get DNS Instructions:**
   - Vercel will show you DNS records to add
   - Usually an A record or CNAME pointing to Vercel

4. **Add to Your DNS Provider:**
   - Go to your domain registrar (where cannycarrot.com is registered)
   - Add the DNS record Vercel provides
   - Type: `A` or `CNAME`
   - Name: `api`
   - Value: `[Vercel provided value]`

5. **Wait for Verification:**
   - Vercel will verify the domain (5-60 minutes)
   - Status will change from "Pending" to "Valid"

## Step 5: Verify Deployment

1. **Check Health Endpoint:**
   - Visit: `https://api.cannycarrot.com/health`
   - Should return JSON with status: "ok" and redis: "connected"

2. **Test Redis Proxy:**
   - Visit: `https://api.cannycarrot.com/api/v1/redis/health`
   - Should return Redis connection status

3. **Update Admin App:**
   - Update `canny-carrot-admin-app/src/services/redis.ts`
   - Change production URL to: `https://api.cannycarrot.com`

## Troubleshooting

### Build Fails?
- Check build logs in Vercel
- Verify all environment variables are set
- Check that `REDIS_URL` is correct
- Ensure TypeScript compiles: `npm run build`

### Function Timeout?
- Vercel serverless functions have a 10s timeout on Hobby plan
- Upgrade to Pro for 60s timeout if needed
- Optimize Redis connection (already using lazy connect)

### Redis Connection Issues?
- Verify `REDIS_URL` is correct
- Check Redis Cloud allows connections from Vercel IPs
- Redis connection is reused across warm invocations

### Domain Not Verifying?
- Wait 5-60 minutes for DNS propagation
- Verify DNS record matches Vercel exactly
- Check DNS settings are saved

## Next Steps

After deployment:
1. Update all apps to use `https://api.cannycarrot.com`
2. Deploy admin app to `admin.cannycarrot.com`
3. Deploy customer app to `app.cannycarrot.com`
4. Deploy business app to `business.cannycarrot.com`
5. Deploy signup website to `www.cannycarrot.com` or `cannycarrot.com`




