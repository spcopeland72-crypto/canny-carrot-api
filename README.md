# Canny Carrot API

Canny Carrot Loyalty Platform API - Powering Tees Valley's Local Business Rewards

## Overview

This is the backend API server for the Canny Carrot loyalty platform. It provides:
- Business and customer management
- Reward and campaign management
- QR code generation and scanning
- Redis database integration
- Payment processing (Stripe)
- E-commerce integrations (Shopify, WooCommerce, eBay)

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** Redis Cloud
- **Deployment:** Vercel (Serverless Functions)

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

See `.env.example` (create from `src/config/env.ts`)

Required:
- `REDIS_URL` - Redis Cloud connection string
- `JWT_SECRET` - Secret for JWT tokens
- `PORT` - Server port (default: 3001)

## Deployment

See `VERCEL_DEPLOY.md` for detailed deployment instructions to Vercel.

## API Endpoints

- `GET /health` - Health check
- `POST /api/v1/redis/:command` - Redis proxy for mobile apps
- `GET /api/v1/businesses` - List businesses
- `POST /api/v1/businesses` - Create business
- And more...

## Production URLs

- API: `https://api.cannycarrot.com`
- Admin: `https://admin.cannycarrot.com`
- Customer App: `https://app.cannycarrot.com`
- Business App: `https://business.cannycarrot.com`





