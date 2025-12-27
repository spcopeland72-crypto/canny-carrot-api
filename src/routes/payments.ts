/**
 * Payment Routes
 * Stripe integration for premium business features
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { redis, redisClient } from '../config/redis';
import { config } from '../config/env';

const router = Router();

// Initialize Stripe with secret key
    const stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2025-11-17.clover',
    });

// Pricing Plans
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: null,
    features: [
      '1 reward program',
      'Up to 50 members',
      'Basic analytics',
      'QR code scanning',
    ],
    limits: {
      rewards: 1,
      members: 50,
      campaigns: 0,
      notifications: 0,
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 1999, // £19.99/month in pence
    interval: 'month',
    features: [
      '3 reward programs',
      'Up to 500 members',
      'Full analytics dashboard',
      'Email campaigns',
      'QR code scanning',
      'Email support',
    ],
    limits: {
      rewards: 3,
      members: 500,
      campaigns: 3,
      notifications: 500,
    },
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 3999, // £39.99/month in pence
    interval: 'month',
    features: [
      'Unlimited reward programs',
      'Unlimited members',
      'Advanced analytics',
      'Push notifications',
      'Geofencing campaigns',
      'Priority support',
      'Custom branding',
    ],
    limits: {
      rewards: -1, // Unlimited
      members: -1,
      campaigns: -1,
      notifications: -1,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null, // Custom pricing
    interval: 'month',
    features: [
      'Everything in Professional',
      'Multi-location support',
      'BID integration',
      'API access',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
    limits: {
      rewards: -1,
      members: -1,
      campaigns: -1,
      notifications: -1,
    },
  },
};

// GET /api/v1/payments/plans - Get available plans
router.get('/plans', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(PLANS),
  });
}));

// GET /api/v1/payments/subscription/:businessId - Get business subscription
router.get('/subscription/:businessId', asyncHandler(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  
  const subscriptionData = await redisClient.get(`subscription:${businessId}`);
  
  if (!subscriptionData) {
    // Default to free plan
    return res.json({
      success: true,
      data: {
        businessId,
        planId: 'free',
        plan: PLANS.free,
        status: 'active',
        currentPeriodEnd: null,
      },
    });
  }
  
  const subscription = JSON.parse(subscriptionData);
  res.json({
    success: true,
    data: {
      ...subscription,
      plan: PLANS[subscription.planId as keyof typeof PLANS],
    },
  });
}));

// POST /api/v1/payments/create-checkout - Create Stripe checkout session
router.post('/create-checkout', asyncHandler(async (req: Request, res: Response) => {
  const { businessId, planId, successUrl, cancelUrl } = req.body;
  
  if (!businessId || !planId) {
    throw new ApiError(400, 'Business ID and Plan ID are required');
  }
  
  const plan = PLANS[planId as keyof typeof PLANS];
  if (!plan || !plan.price) {
    throw new ApiError(400, 'Invalid plan selected');
  }
  
  // Verify business exists
  const business = await redis.getBusiness(businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'gbp',
        product_data: { 
          name: `Canny Carrot ${plan.name}`,
          description: `${plan.name} subscription for ${business.name}`,
        },
        unit_amount: plan.price,
        recurring: { interval: plan.interval as 'month' },
      },
      quantity: 1,
    }],
    success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: cancelUrl,
    metadata: { businessId, planId },
    customer_email: business.email,
  });
  
  res.json({
    success: true,
    data: {
      sessionId: session.id,
      url: session.url,
    },
  });
}));

// POST /api/v1/payments/webhook - Stripe webhook handler
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  // In production, verify Stripe signature:
  // const sig = req.headers['stripe-signature'];
  // const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  
  const event = req.body;
  
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const { businessId, planId } = session.metadata;
      
      // Update subscription
      const subscription = {
        businessId,
        planId,
        stripeSubscriptionId: session.subscription,
        stripeCustomerId: session.customer,
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      
      await redisClient.set(`subscription:${businessId}`, JSON.stringify(subscription));
      console.log(`Subscription activated for business ${businessId}: ${planId}`);
      break;
    }
    
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      console.log(`Payment succeeded for subscription ${invoice.subscription}`);
      break;
    }
    
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log(`Payment failed for subscription ${invoice.subscription}`);
      // Would update subscription status and notify business
      break;
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      // Find business by subscription ID and downgrade to free
      console.log(`Subscription cancelled: ${subscription.id}`);
      break;
    }
  }
  
  res.json({ received: true });
}));

// POST /api/v1/payments/cancel - Cancel subscription
router.post('/cancel', asyncHandler(async (req: Request, res: Response) => {
  const { businessId } = req.body;
  
  if (!businessId) {
    throw new ApiError(400, 'Business ID is required');
  }
  
  const subscriptionData = await redisClient.get(`subscription:${businessId}`);
  if (!subscriptionData) {
    throw new ApiError(404, 'No subscription found');
  }
  
  const subscription = JSON.parse(subscriptionData);
  
  // In production, this would cancel with Stripe:
  // await stripe.subscriptions.del(subscription.stripeSubscriptionId);
  
  // Update local record
  subscription.status = 'cancelled';
  subscription.cancelledAt = new Date().toISOString();
  await redisClient.set(`subscription:${businessId}`, JSON.stringify(subscription));
  
  res.json({
    success: true,
    message: 'Subscription cancelled. You will retain access until the end of your billing period.',
    data: subscription,
  });
}));

// GET /api/v1/payments/usage/:businessId - Get usage against limits
router.get('/usage/:businessId', asyncHandler(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  
  // Get subscription
  const subscriptionData = await redisClient.get(`subscription:${businessId}`);
  const planId = subscriptionData 
    ? JSON.parse(subscriptionData).planId 
    : 'free';
  
  const plan = PLANS[planId as keyof typeof PLANS];
  
  // Get current usage
  const business = await redis.getBusiness(businessId);
  const memberCount = await redisClient.scard(`business:${businessId}:members`);
  const rewardCount = await redisClient.scard(`business:${businessId}:rewards`);
  const campaignCount = await redisClient.scard(`business:${businessId}:campaigns`);
  
  // Get notification count for current month
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const notificationCount = parseInt(await redisClient.get(`notifications:${businessId}:${monthKey}`) || '0');
  
  const usage = {
    members: {
      current: memberCount,
      limit: plan.limits.members,
      percentage: plan.limits.members === -1 ? 0 : (memberCount / plan.limits.members) * 100,
    },
    rewards: {
      current: rewardCount,
      limit: plan.limits.rewards,
      percentage: plan.limits.rewards === -1 ? 0 : (rewardCount / plan.limits.rewards) * 100,
    },
    campaigns: {
      current: campaignCount,
      limit: plan.limits.campaigns,
      percentage: plan.limits.campaigns === -1 ? 0 : (campaignCount / plan.limits.campaigns) * 100,
    },
    notifications: {
      current: notificationCount,
      limit: plan.limits.notifications,
      percentage: plan.limits.notifications === -1 ? 0 : (notificationCount / plan.limits.notifications) * 100,
    },
  };
  
  // Check if any limits are exceeded
  const warnings: string[] = [];
  if (usage.members.percentage >= 80 && plan.limits.members !== -1) {
    warnings.push(`You're using ${Math.round(usage.members.percentage)}% of your member limit`);
  }
  if (usage.rewards.percentage >= 100 && plan.limits.rewards !== -1) {
    warnings.push('You\'ve reached your reward program limit');
  }
  
  res.json({
    success: true,
    data: {
      planId,
      planName: plan.name,
      usage,
      warnings,
      upgradeRequired: warnings.length > 0,
    },
  });
}));

// POST /api/v1/payments/customer-portal - Create customer portal session
router.post('/customer-portal', asyncHandler(async (req: Request, res: Response) => {
  const { businessId, returnUrl } = req.body;
  
  if (!businessId) {
    throw new ApiError(400, 'Business ID is required');
  }
  
  const subscriptionData = await redisClient.get(`subscription:${businessId}`);
  if (!subscriptionData) {
    throw new ApiError(404, 'No subscription found');
  }
  
  const subscription = JSON.parse(subscriptionData);
  
  if (!subscription.stripeCustomerId) {
    throw new ApiError(400, 'No Stripe customer associated with this subscription');
  }
  
  // Create Stripe customer portal session
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: returnUrl,
  });
  
  res.json({
    success: true,
    data: {
      url: session.url,
    },
  });
}));

// GET /api/v1/payments/config - Get Stripe publishable key for client
router.get('/config', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      publishableKey: config.stripe.publishableKey,
    },
  });
}));

export default router;

