// AI Personalization Types
// For Canny Carrot's AI-powered recommendation engine

// ============================================
// USER FEATURES
// ============================================

export interface UserFeatures {
  // Demographics
  ageBand?: '18-24' | '25-34' | '35-44' | '45-54' | '55+';
  homeRegion?: string;
  
  // Behaviour
  visitFrequency: number;        // Visits per week
  recency: number;              // Days since last visit
  averageSpend: number;          // £ per visit
  categoryAffinity: Record<string, number>; // { 'cafe': 0.8, 'restaurant': 0.6 }
  
  // Channel preferences (0-1 engagement scores)
  channelPreferences: {
    push: number;
    email: number;
    sms: number;
  };
  
  // Engagement metrics
  openRate: number;             // 0-1
  clickRate: number;            // 0-1
  conversionRate: number;       // 0-1
  streakDays: number;           // Current streak
  longestStreak: number;
  
  // Calculated scores
  churnRisk?: number;           // 0-1 probability
  visitPropensity?: number;    // 0-1 probability (next 7 days)
  redemptionPropensity?: number; // 0-1 probability (next 14 days)
  lifetimeValue?: number;      // Estimated CLV in £
}

// ============================================
// CONTEXTUAL SIGNALS
// ============================================

export interface ContextualSignals {
  timestamp: string;
  timeOfDay: number;            // 0-23
  dayOfWeek: number;            // 0-6 (Sunday = 0)
  weather?: {
    condition: string;          // 'sunny', 'rainy', etc.
    temperature: number;        // Celsius
  };
  location?: {
    latitude: number;
    longitude: number;
    inGeofence?: string;        // Geofence zone ID
    nearbyBusinesses?: string[]; // Business IDs within 500m
  };
  calendarEvents?: string[];    // ['matchday', 'festival', 'holiday', 'bank_holiday']
  inStoreBusinessId?: string;  // If user is currently in a store
  channel: 'in_app' | 'push' | 'email' | 'sms';
}

// ============================================
// RECOMMENDATIONS
// ============================================

export type RecommendationType = 
  | 'highlight_program'      // Show this program prominently
  | 'promote_reward'         // Highlight this reward
  | 'trigger_notification'   // Send notification
  | 'suggest_campaign'       // Enroll in campaign
  | 'show_offer';            // Display special offer

export interface RecommendedAction {
  type: RecommendationType;
  priority: number;           // 0-1 confidence score
  reason: string;             // Human-readable explanation
  metadata: {
    // For highlight_program
    programId?: string;
    stampsUntilReward?: number;
    distanceMeters?: number;
    
    // For promote_reward
    rewardId?: string;
    affinityScore?: number;
    timeWindow?: string;
    
    // For trigger_notification
    campaignId?: string;
    channel?: 'push' | 'email' | 'sms';
    message?: string;
    
    // For suggest_campaign
    campaignType?: string;
    expectedUplift?: number;
    
    // For show_offer
    offerId?: string;
    discountPercent?: number;
    validUntil?: string;
  };
}

export interface PersonalisationResponse {
  recommendedActions: RecommendedAction[];
  personalisationTags: string[];  // e.g., ["likely_lunch_visit", "coffee_bundler"]
  churnRisk?: number;            // 0-1
  visitPropensity?: number;      // 0-1
  redemptionPropensity?: number;  // 0-1
  nextBestVisitDay?: string;     // ISO date
  categoryAffinity?: Record<string, number>;
  suggestedSegments?: string[];  // AI-generated segment IDs
}

// ============================================
// SEGMENTATION
// ============================================

export interface AISegment {
  id: string;
  businessId?: string;          // Business-specific or global
  name: string;                 // e.g., "Lunchtime Loyalists"
  description: string;
  type: 'saved' | 'ai_generated' | 'dynamic';
  criteria: SegmentCriteria;
  memberCount: number;
  characteristics: {
    averageVisitFrequency: number;
    preferredTimeOfDay: number[];
    preferredDayOfWeek: number[];
    averageSpend: number;
    topCategories: string[];
  };
  lastCalculatedAt: string;
  createdAt: string;
}

export interface SegmentCriteria {
  // Behavioural
  visitFrequency?: { min?: number; max?: number };
  recency?: { min?: number; max?: number }; // Days
  totalSpend?: { min?: number; max?: number };
  
  // Temporal
  preferredTimeOfDay?: number[];
  preferredDayOfWeek?: number[];
  
  // Category
  categoryAffinity?: string[];  // Must have affinity to these categories
  
  // Engagement
  churnRisk?: { min?: number; max?: number };
  visitPropensity?: { min?: number; max?: number };
  
  // AI-generated
  clusterId?: string;          // ML cluster identifier
  behaviorPattern?: string;    // Discovered pattern
}

// ============================================
// PROPENSITY SCORES
// ============================================

export interface PropensityScores {
  userId: string;
  visitPropensity: number;      // P(visits in next 7 days)
  redemptionPropensity: number;  // P(redeems in next 14 days)
  churnRisk: number;            // P(churns in next 30 days)
  basketSizeUplift: number;     // Expected % increase in basket size
  frequencyUplift: number;      // Expected % increase in visit frequency
  calculatedAt: string;
  modelVersion: string;
}

// ============================================
// UPLIFT MODELLING
// ============================================

export interface UpliftScore {
  userId: string;
  campaignId?: string;
  rewardId?: string;
  uplift: number;              // 0-1: How much more likely to visit with incentive
  baselineProbability: number;  // P(visits without incentive)
  treatedProbability: number;    // P(visits with incentive)
  confidence: number;          // 0-1: Model confidence
  calculatedAt: string;
}

// ============================================
// MERCHANT AI RECOMMENDATIONS
// ============================================

export interface MerchantAIRecommendation {
  id: string;
  businessId: string;
  type: 'campaign' | 'reward' | 'segment' | 'pricing' | 'timing';
  title: string;
  description: string;
  reasoning: string;            // Why AI suggests this
  expectedImpact: {
    visits?: number;           // Expected increase in visits
    revenue?: number;          // Expected £ increase
    redemptions?: number;      // Expected increase in redemptions
    confidence: number;        // 0-1 confidence in prediction
  };
  action: {
    type: string;
    parameters: Record<string, any>;
  };
  priority: number;            // 0-1: How important this recommendation is
  createdAt: string;
  dismissedAt?: string;
  implementedAt?: string;
}

// ============================================
// FRAUD DETECTION
// ============================================

export interface FraudSignal {
  id: string;
  userId?: string;
  businessId?: string;
  type: 'excessive_redemptions' | 'suspicious_velocity' | 'device_farm' | 'staff_abuse' | 'pattern_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: Record<string, any>;
  score: number;               // 0-1 fraud probability
  detectedAt: string;
  reviewedAt?: string;
  resolvedAt?: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'false_positive';
}

// ============================================
// EXPLAINABILITY
// ============================================

export interface RecommendationExplanation {
  recommendationId: string;
  explanation: string;         // Human-readable
  factors: Array<{
    factor: string;            // e.g., "Visit frequency"
    impact: number;            // -1 to 1 (negative to positive)
    description: string;
  }>;
  confidence: number;          // 0-1
  alternatives?: RecommendedAction[];
}

// ============================================
// MODEL METADATA
// ============================================

export interface ModelMetadata {
  modelId: string;
  modelType: 'recommender' | 'propensity' | 'churn' | 'uplift' | 'segmentation' | 'fraud';
  version: string;
  trainedAt: string;
  performance: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    auc?: number;              // For binary classification
  };
  features: string[];          // Features used in model
  hyperparameters: Record<string, any>;
}




















