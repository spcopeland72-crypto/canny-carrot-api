// Extended Types - Aligned with GPT Schema
// These extend the core types in index.ts

import { Member, Business, Reward, Campaign } from './index';

// ============================================
// IDENTITY & ACCESS
// ============================================

/**
 * Device for push notifications
 */
export interface Device {
  id: string;
  userId: string;
  platform: 'ios' | 'android' | 'web';
  token: string;
  deviceId?: string;
  lastActiveAt: string;
  createdAt: string;
}

/**
 * Business User (Staff/Admin accounts)
 */
export interface BusinessUser {
  id: string;
  businessId: string;
  userId: string;               // Links to User/Member
  role: 'owner' | 'admin' | 'staff';
  permissions: string[];         // Granular permissions
  status: 'active' | 'inactive';
  createdAt: string;
  lastLoginAt?: string;
}

// ============================================
// LOYALTY & PROGRAMS
// ============================================

/**
 * Loyalty Program (separate from Business)
 * Allows businesses to have multiple programs
 */
export interface LoyaltyProgram {
  id: string;
  businessId: string;
  name: string;                  // e.g., "Coffee Rewards"
  type: 'points' | 'stamp' | 'tiered' | 'subscription';
  currency: 'points' | 'stamps' | 'credits';
  status: 'draft' | 'active' | 'paused' | 'ended';
  defaultEarnRate?: number;      // Points per £1 spent
  createdAt: string;
  updatedAt: string;
}

/**
 * Program Location (program coverage per location)
 */
export interface ProgramLocation {
  id: string;
  programId: string;
  locationId: string;
  isActive: boolean;
  earnRate?: number;             // Override default earn rate
  rules?: Record<string, any>;   // Location-specific rules
}

/**
 * Program Tier (for tiered loyalty)
 */
export interface ProgramTier {
  id: string;
  programId: string;
  name: string;                  // e.g., "Bronze", "Silver", "Gold"
  level: number;                 // 1, 2, 3...
  minPoints?: number;            // Points required
  minSpend?: number;              // Lifetime spend required
  benefits: string[];            // Tier benefits
  badgeIcon?: string;
  createdAt: string;
}

/**
 * Program Rule (earn/burn/expiry rules)
 */
export interface ProgramRule {
  id: string;
  programId: string;
  type: 'earn' | 'burn' | 'expiry' | 'bonus';
  name: string;
  conditions: {
    minSpend?: number;
    productCategories?: string[];
    dayOfWeek?: number[];
    timeRange?: { start: string; end: string };
    locations?: string[];
  };
  action: {
    multiplier?: number;         // 2x points
    bonusPoints?: number;
    expiryDays?: number;
  };
  priority: number;              // Rule evaluation order
  isActive: boolean;
  createdAt: string;
}

/**
 * Customer Membership (user's enrollment in a program)
 */
export interface CustomerMembership {
  id: string;
  userId: string;
  programId: string;
  joinedAt: string;
  status: 'active' | 'paused' | 'cancelled';
  currentTierId?: string;
  pausedUntil?: string;
  cancelledAt?: string;
  // Unique constraint: (userId, programId)
}

/**
 * Points Balance (unified balance tracking)
 */
export interface PointsBalance {
  id: string;
  membershipId: string;
  availablePoints: number;      // Can be used now
  pendingPoints: number;          // Pending approval
  lifetimePoints: number;         // Total ever earned
  lifetimeRedeemed: number;       // Total ever redeemed
  lastEarnAt?: string;
  lastRedeemAt?: string;
  expiresAt?: string;            // Next expiry date
  updatedAt: string;
}

/**
 * Transaction (unified transaction model)
 * Replaces separate Stamp/Redemption entities
 */
export interface Transaction {
  id: string;
  membershipId: string;
  businessId: string;
  locationId?: string;
  type: 'earn' | 'redeem' | 'adjust' | 'expire' | 'refund';
  source: 'qr' | 'nfc' | 'online' | 'receipt_scan' | 'manual' | 'pos';
  amountPoints: number;           // Positive for earn, negative for redeem
  monetaryValue?: number;         // £ value
  receiptId?: string;
  orderId?: string;
  description?: string;
  occurredAt: string;
  processedBy?: string;          // BusinessUser ID or 'system'
  metadata?: Record<string, any>;
}

// ============================================
// LOCATION MANAGEMENT
// ============================================

/**
 * Location (multi-location support)
 */
export interface Location {
  id: string;
  businessId: string;
  name: string;                  // e.g., "Middlesbrough Store"
  address: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    country: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  openingHours: OpeningHours;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OpeningHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
  exceptions?: Array<{
    date: string;                // ISO date
    open?: string;               // HH:MM
    close?: string;              // HH:MM
    closed: boolean;
  }>;
}

export interface DayHours {
  open: string;                  // HH:MM format
  close: string;                 // HH:MM format
  closed?: boolean;
}

// ============================================
// ENGAGEMENT & MARKETING
// ============================================

/**
 * Segment (customer segmentation)
 */
export interface Segment {
  id: string;
  businessId: string;
  name: string;
  type: 'saved' | 'ai_generated' | 'dynamic';
  criteria: {
    membershipStatus?: string[];
    lastVisitDays?: number;
    totalSpend?: { min?: number; max?: number };
    favoriteCategories?: string[];
    location?: string[];
    predictedChurn?: boolean;
    highValue?: boolean;
  };
  memberCount?: number;          // Cached count
  lastCalculatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Campaign Rule (detailed campaign rules)
 */
export interface CampaignRule {
  id: string;
  campaignId: string;
  type: 'trigger' | 'condition' | 'action';
  name: string;
  conditions: Record<string, any>;
  action: Record<string, any>;
  priority: number;
}

/**
 * Geofence Zone
 */
export interface GeofenceZone {
  id: string;
  locationId: string;
  name: string;
  center: {
    latitude: number;
    longitude: number;
  };
  radius: number;                // Meters
  triggerOn: 'enter' | 'exit' | 'both';
  notificationId?: string;       // Notification to send
  isActive: boolean;
  createdAt: string;
}

/**
 * Check-In
 */
export interface CheckIn {
  id: string;
  userId: string;
  locationId: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  method: 'qr' | 'nfc' | 'manual' | 'auto';
  checkedInAt: string;
  checkedOutAt?: string;
}

// ============================================
// SOCIAL & COMMUNITY
// ============================================

/**
 * Review
 */
export interface Review {
  id: string;
  userId: string;
  businessId: string;
  locationId?: string;
  rating: number;                // 1-5
  text?: string;
  photos?: string[];             // Photo URLs
  visibility: 'public' | 'merchant_only';
  helpfulCount: number;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

/**
 * Follow
 */
export interface Follow {
  id: string;
  followerId: string;           // User following
  followingId: string;           // User or Business being followed
  followingType: 'user' | 'business';
  createdAt: string;
}

/**
 * Referral (enhanced)
 */
export interface Referral {
  id: string;
  referrerId: string;           // User who referred
  referredId: string;            // User who was referred
  programId?: string;
  status: 'pending' | 'completed' | 'rewarded';
  rewardGiven: boolean;
  rewardAmount?: number;
  createdAt: string;
  completedAt?: string;
}

// ============================================
// SUPPORT & OPERATIONS
// ============================================

/**
 * Support Ticket
 */
export interface SupportTicket {
  id: string;
  userId?: string;               // Customer ticket
  businessId?: string;           // Business ticket
  category: 'points_missing' | 'login_issue' | 'integration_issue' | 'billing' | 'other';
  subject: string;
  description: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;           // Support agent ID
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

/**
 * Integration (unified integration model)
 */
export interface Integration {
  id: string;
  businessId: string;
  type: 'pos' | 'ecommerce' | 'payment' | 'analytics';
  platform: 'shopify' | 'woocommerce' | 'ebay' | 'etsy' | 'amazon' | 'square' | 'stripe' | 'custom';
  status: 'connected' | 'error' | 'disconnected';
  credentials?: Record<string, any>; // Encrypted
  settings: Record<string, any>;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Webhook Subscription
 */
export interface WebhookSubscription {
  id: string;
  integrationId: string;
  eventType: string;
  endpoint: string;
  secret: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
}




















