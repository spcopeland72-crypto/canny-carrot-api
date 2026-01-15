// Core Types for Canny Carrot Loyalty Platform

export interface Customer {
  id: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;          // ISO date (for birthday campaigns)
  homeRegion?: string;           // e.g., "tees-valley"
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;            // Soft delete support
  preferences: CustomerPreferences;
  // Aggregated stats
  totalStamps: number;
  totalRedemptions: number;
  favoriteBusiness?: string;
  // Gamification
  achievements?: string[];
  referralCode?: string;
  referredBy?: string;
  // Device tracking (for push notifications)
  deviceTokens?: Array<{
    platform: 'ios' | 'android' | 'web';
    token: string;
    deviceId?: string;
    lastActiveAt?: string;
  }>;
}

// Member type (alias for Customer - for backward compatibility)
export type Member = Customer;

export interface CustomerPreferences {
  notifications: boolean;
  push?: boolean;
  email?: boolean;
  sms?: boolean;
  marketing: boolean;
  geofencing?: boolean;
}

export interface Business {
  id: string;
  legalName?: string;            // Legal entity name
  name: string;                  // Display name (customer-facing)
  slug: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    line2?: string;
    city: string; // Middlesbrough, Stockton, Darlington, etc.
    postcode: string;
    region: 'tees-valley';
  };
  category: BusinessCategory;
  bidId?: string; // Business Improvement District ID
  billingPlan?: PaymentPlan['id']; // From payments.ts
  status: 'active' | 'suspended' | 'cancelled';
  logo?: string;
  description?: string;
  products?: string[];           // List of products created by this business
  actions?: string[];            // List of actions created by this business
  createdAt: string;
  updatedAt: string;
  settings: BusinessSettings;
  stats: BusinessStats;
}

export type BusinessCategory = 
  | 'cafe'
  | 'restaurant'
  | 'beauty-salon'
  | 'barber'
  | 'retail'
  | 'pub'
  | 'takeaway'
  | 'gym'
  | 'other';

export interface BusinessSettings {
  stampValidationMethod: 'qr' | 'code' | 'nfc' | 'manual';
  autoRewardEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface BusinessStats {
  totalCustomers: number;
  totalStampsIssued: number;
  totalRedemptions: number;
  activeRewards: number;
}

export interface Reward {
  id: string;
  businessId: string;
  programId?: string;           // For multi-program support
  name: string;
  description: string;
  costPoints?: number;           // For points-based programs
  costStamps?: number;           // For stamp-based programs (stampsRequired)
  stampsRequired: number;        // Legacy field (maps to costStamps)
  type: 'product' | 'discount' | 'freebie' | 'experience' | 'voucher' | 'upgrade';
  value?: number; // For discounts, the amount off
  isActive: boolean;
  validFrom: string;             // When reward becomes available
  validTo?: string;              // When reward expires
  expiresAt?: string;            // Legacy field (maps to validTo)
  constraints?: {
    minSpend?: number;
    dayOfWeek?: number[];         // 0-6 for Sunday-Saturday
    timeRange?: { start: string; end: string }; // HH:MM format
    locations?: string[];         // Location IDs
    maxUsesPerMember?: number;
  };
  maxRedemptions?: number;
  currentRedemptions: number;
  // Customer progress tracking: customerId -> points collected
  customerProgress?: Record<string, number>;  // Maps customerId to points earned
  createdAt: string;
  updatedAt: string;
}

export interface Stamp {
  id: string;
  customerId: string;
  memberId?: string;             // Legacy alias for customerId (backward compatibility)
  businessId: string;
  programId?: string;            // For multi-program support
  locationId?: string;           // Which location issued it
  rewardId: string;
  transactionId?: string;       // Link to unified Transaction
  issuedAt: string;
  issuedBy: string; // Staff customer ID or 'system'
  method: 'qr' | 'code' | 'nfc' | 'manual' | 'online' | 'pos' | 'receipt_scan';
  monetaryValue?: number;        // £ value of transaction
  orderId?: string;              // E-commerce order reference
  receiptId?: string;            // Receipt reference
  metadata?: Record<string, any>;
}

export interface Redemption {
  id: string;
  customerId: string;
  memberId?: string;             // Legacy alias for customerId (backward compatibility)
  businessId: string;
  rewardId: string;
  redeemedAt: string;
  verifiedBy?: string;
  status: 'pending' | 'completed' | 'cancelled';
}

// Campaign types
export interface Campaign {
  id: string;
  businessId: string;
  name: string;
  description: string;
  type: CampaignType;
  objective?: 'reactivate' | 'upsell' | 'retention' | 'acquisition' | 'engagement';
  startDate: string;
  startAt?: string;              // Alias for startDate
  endDate: string;
  endAt?: string;                // Alias for endDate
  status: CampaignStatus;
  targetAudience: 'all' | 'new' | 'returning' | 'inactive';
  segmentId?: string;            // Link to Segment entity
  conditions?: CampaignConditions;
  channelMasks?: {
    push: boolean;
    email: boolean;
    sms: boolean;
    inApp: boolean;
    geo: boolean;
  };
  notificationMessage?: string;
  // Customer progress tracking: customerId -> points collected
  customerProgress?: Record<string, number>;  // Maps customerId to points earned
  createdAt: string;
  updatedAt: string;
  stats: CampaignStats;
}

export type CampaignType = 
  | 'double_stamps'    // 2x stamps for every purchase
  | 'bonus_reward'     // Extra bonus on top of regular reward
  | 'flash_sale'       // Limited time discount
  | 'referral'         // Referral bonus campaign
  | 'birthday'         // Birthday rewards
  | 'happy_hour'       // Time-based promotions
  | 'loyalty_tier';    // VIP tier unlock

export type CampaignStatus = 
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface CampaignConditions {
  bonusStamps?: number;
  discountPercent?: number;
  minPurchase?: number;
  maxUsesPerMember?: number;
  daysOfWeek?: number[]; // 0-6 for Sunday-Saturday
  startTime?: string; // HH:MM format
  endTime?: string;
}

export interface CampaignStats {
  impressions: number;
  clicks: number;
  conversions: number;
}

// Notification types
export interface Notification {
  id: string;
  type: NotificationType;
  notificationType?: 'transactional' | 'marketing' | 'system'; // Align with GPT schema
  customerId: string;
  userId?: string;               // Alias for customerId
  businessId?: string;
  campaignId?: string;
  title: string;
  message: string;
  channel?: 'push' | 'email' | 'sms' | 'in_app';
  payload?: Record<string, any>; // Deep link data
  data?: Record<string, any>;   // Legacy field (maps to payload)
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  convertedAt?: string;          // User took action
  createdAt: string;
  read: boolean;
  readAt?: string;
}

export type NotificationType = 
  | 'stamp_earned'
  | 'reward_available'
  | 'reward_redeemed'
  | 'campaign'
  | 'geofence_enter'
  | 'achievement'
  | 'leaderboard'
  | 'referral'
  | 'general';

// Gamification types
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface LeaderboardEntry {
  rank: number;
  customerId: string;
  firstName: string;
  lastName: string;
  score: number;
  badges: string[];
}

// BID (Business Improvement District) types
export interface BID {
  id: string;
  name: string; // e.g., "Middlesbrough Town Centre BID"
  region: string;
  council: 'middlesbrough' | 'stockton' | 'darlington';
  managerId: string;
  businesses: string[]; // Business IDs
  createdAt: string;
}

export interface BIDStats {
  bidId: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: string;
  totalBusinesses: number;
  activeBusinesses: number;
  totalMembers: number;
  newMembers: number;
  totalStamps: number;
  totalRedemptions: number;
  footfallEstimate?: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Regional Analytics
export interface RegionalStats {
  region: 'tees-valley';
  councils: {
    middlesbrough: CouncilStats;
    stockton: CouncilStats;
    darlington: CouncilStats;
  };
  totals: {
    businesses: number;
    customers: number;
    stamps: number;
    redemptions: number;
    estimatedEconomicImpact: number; // £ value
  };
  period: string;
  generatedAt: string;
}

export interface CouncilStats {
  businesses: number;
  members: number;
  stamps: number;
  redemptions: number;
  topCategories: Array<{
    category: BusinessCategory;
    count: number;
  }>;
}

// Payment Plans
export interface PaymentPlan {
  id: 'free' | 'starter' | 'professional' | 'enterprise';
  name: string;
  price: number;                 // In pence
  interval: 'month' | 'year' | null;
  features: string[];
  limits: {
    rewards: number;
    customers: number;
    campaigns: number;
    notifications: number;
  };
}

