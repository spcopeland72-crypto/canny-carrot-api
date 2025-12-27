// AI Personalization Service
// Provides personalized recommendations for users

import { redisClient } from '../config/redis';
import { redis, REDIS_KEYS } from '../config/redis';
import { 
  UserFeatures, 
  ContextualSignals, 
  RecommendedAction, 
  PersonalisationResponse,
  PropensityScores,
} from '../types/ai';
import { Member, Business, Reward, Campaign } from '../types';

export class PersonalisationService {
  
  // ============================================
  // FEATURE CALCULATION
  // ============================================
  
  /**
   * Calculate user features for ML models
   */
  async calculateUserFeatures(userId: string): Promise<UserFeatures> {
    const member = await redis.getMember(userId);
    if (!member) {
      throw new Error('Member not found');
    }
    
    // Get all businesses user has stamps with
    const businessKeys = await redisClient.keys(`member:${userId}:stamps:*`);
    const businessIds = businessKeys.map(key => key.split(':')[3]);
    
    // Calculate visit frequency (visits per week)
    const stamps = await Promise.all(
      businessIds.map(async (businessId) => {
        const count = await redis.getStampCount(userId, businessId);
        const stamps = await redisClient.lrange(
          REDIS_KEYS.memberStamps(userId, businessId),
          0,
          -1
        );
        return { businessId, count, stamps: stamps.map(s => JSON.parse(s)) };
      })
    );
    
    const totalStamps = stamps.reduce((sum, s) => sum + s.count, 0);
    const daysSinceJoin = Math.max(
      1,
      Math.floor((Date.now() - new Date(member.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    );
    const visitFrequency = (totalStamps / daysSinceJoin) * 7; // Per week
    
    // Calculate recency (days since last visit)
    const allStamps = stamps.flatMap(s => s.stamps);
    const lastStamp = allStamps.sort((a, b) => 
      new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
    )[0];
    const recency = lastStamp 
      ? Math.floor((Date.now() - new Date(lastStamp.issuedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    
    // Calculate category affinity (simplified - would need business categories)
    const categoryAffinity: Record<string, number> = {};
    // TODO: Get business categories and calculate affinity
    
    // Calculate engagement metrics (simplified)
    const notifications = await redisClient.lrange(
      `member:${userId}:notifications`,
      0,
      99
    );
    const notificationData = notifications.map(n => JSON.parse(n));
    const opened = notificationData.filter(n => n.openedAt).length;
    const clicked = notificationData.filter(n => n.clickedAt).length;
    const converted = notificationData.filter(n => n.convertedAt).length;
    
    const openRate = notificationData.length > 0 ? opened / notificationData.length : 0;
    const clickRate = opened > 0 ? clicked / opened : 0;
    const conversionRate = clicked > 0 ? converted / clicked : 0;
    
    // Calculate streak (simplified - consecutive days with stamps)
    const streakDays = this.calculateStreak(allStamps);
    
    return {
      visitFrequency,
      recency,
      averageSpend: 0, // TODO: Calculate from transaction data
      categoryAffinity,
      channelPreferences: {
        push: 0.7, // TODO: Calculate from notification engagement
        email: 0.5,
        sms: 0.3,
      },
      openRate,
      clickRate,
      conversionRate,
      streakDays,
      longestStreak: streakDays, // TODO: Calculate properly
    };
  }
  
  /**
   * Calculate current streak (consecutive days with stamps)
   */
  private calculateStreak(stamps: any[]): number {
    if (stamps.length === 0) return 0;
    
    const dates = stamps
      .map(s => new Date(s.issuedAt).toISOString().split('T')[0])
      .filter((date, index, self) => self.indexOf(date) === index)
      .sort()
      .reverse();
    
    if (dates.length === 0) return 0;
    
    let streak = 1;
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < dates.length; i++) {
      const expectedDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      
      if (dates[i] === expectedDate) {
        streak = i + 1;
      } else {
        break;
      }
    }
    
    return streak;
  }
  
  // ============================================
  // RECOMMENDATIONS
  // ============================================
  
  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(
    userId: string,
    context: ContextualSignals
  ): Promise<PersonalisationResponse> {
    const member = await redis.getMember(userId);
    if (!member) {
      throw new Error('Member not found');
    }
    
    // Calculate user features
    const features = await this.calculateUserFeatures(userId);
    
    // Calculate propensity scores
    const propensity = await this.calculatePropensityScores(userId, features);
    
    // Generate recommendations
    const actions = await this.generateRecommendations(userId, features, context, propensity);
    
    // Generate personalisation tags
    const tags = this.generatePersonalisationTags(features, propensity);
    
    return {
      recommendedActions: actions,
      personalisationTags: tags,
      churnRisk: propensity.churnRisk,
      visitPropensity: propensity.visitPropensity,
      redemptionPropensity: propensity.redemptionPropensity,
      nextBestVisitDay: this.predictNextVisitDay(features, context),
      categoryAffinity: features.categoryAffinity,
    };
  }
  
  /**
   * Generate personalized recommendations
   */
  private async generateRecommendations(
    userId: string,
    features: UserFeatures,
    context: ContextualSignals,
    propensity: PropensityScores
  ): Promise<RecommendedAction[]> {
    const actions: RecommendedAction[] = [];
    
    // Get user's active programs (businesses with stamps)
    const businessKeys = await redisClient.keys(`member:${userId}:stamps:*`);
    const businessIds = businessKeys.map(key => key.split(':')[3]);
    
    // 1. Highlight programs close to reward
    for (const businessId of businessIds) {
      const stampCount = await redis.getStampCount(userId, businessId);
      const business = await redis.getBusiness(businessId);
      
      if (business) {
        const rewardIds = await redisClient.smembers(REDIS_KEYS.businessRewards(businessId));
        const rewards = await Promise.all(
          rewardIds.map(id => redisClient.get(REDIS_KEYS.reward(id)))
        );
        
        const activeRewards = rewards
          .filter((r): r is string => r !== null)
          .map(r => JSON.parse(r))
          .filter((r: Reward) => r.isActive);
        
        const closestReward = activeRewards
          .filter((r: Reward) => stampCount < r.stampsRequired)
          .sort((a: Reward, b: Reward) => a.stampsRequired - b.stampsRequired)[0];
        
        if (closestReward) {
          const stampsUntil = closestReward.stampsRequired - stampCount;
          if (stampsUntil <= 3) {
            actions.push({
              type: 'highlight_program',
              priority: 1 - (stampsUntil / 10), // Higher priority if closer
              reason: `You're ${stampsUntil} stamp${stampsUntil > 1 ? 's' : ''} away from ${closestReward.name} at ${business.name}!`,
              metadata: {
                programId: businessId,
                stampsUntilReward: stampsUntil,
              },
            });
          }
        }
      }
    }
    
    // 2. Promote rewards based on time of day
    if (context.timeOfDay >= 11 && context.timeOfDay <= 14) {
      // Lunch time
      const lunchRewards = await this.findTimeBasedRewards(businessIds, 'lunch');
      for (const reward of lunchRewards) {
        actions.push({
          type: 'promote_reward',
          priority: 0.8,
          reason: 'Perfect time for lunch rewards!',
          metadata: {
            rewardId: reward.id,
            affinityScore: 0.85,
            timeWindow: '11:00-14:00',
          },
        });
      }
    }
    
    // 3. Trigger notifications for high churn risk
    if (propensity.churnRisk > 0.6) {
      actions.push({
        type: 'trigger_notification',
        priority: 0.9,
        reason: 'We miss you! Here\'s a special offer to welcome you back.',
        metadata: {
          channel: 'push',
          message: 'Come back and earn double stamps on your next visit!',
        },
      });
    }
    
    // 4. Location-based recommendations
    if (context.location) {
      const nearbyBusinesses = await this.findNearbyBusinesses(
        context.location.latitude,
        context.location.longitude,
        500 // 500m radius
      );
      
      for (const business of nearbyBusinesses.slice(0, 2)) {
        actions.push({
          type: 'highlight_program',
          priority: 0.7,
          reason: `${business.name} is nearby!`,
          metadata: {
            programId: business.id,
            distanceMeters: 250, // TODO: Calculate actual distance
          },
        });
      }
    }
    
    // Sort by priority
    return actions.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }
  
  /**
   * Calculate propensity scores
   */
  private async calculatePropensityScores(
    userId: string,
    features: UserFeatures
  ): Promise<PropensityScores> {
    // Simplified scoring (would use ML model in production)
    
    // Visit propensity: Based on recency and frequency
    let visitPropensity = 0.5;
    if (features.recency <= 7) visitPropensity = 0.8;
    else if (features.recency <= 14) visitPropensity = 0.6;
    else if (features.recency <= 30) visitPropensity = 0.4;
    else visitPropensity = 0.2;
    
    // Adjust by frequency
    if (features.visitFrequency > 2) visitPropensity += 0.1;
    if (features.visitFrequency > 4) visitPropensity += 0.1;
    visitPropensity = Math.min(1, visitPropensity);
    
    // Redemption propensity: Based on available rewards
    const businessKeys = await redisClient.keys(`member:${userId}:stamps:*`);
    let redemptionPropensity = 0.3;
    for (const key of businessKeys) {
      const businessId = key.split(':')[3];
      const stampCount = await redis.getStampCount(userId, businessId);
      const rewardIds = await redisClient.smembers(REDIS_KEYS.businessRewards(businessId));
      const rewards = await Promise.all(
        rewardIds.map(id => redisClient.get(REDIS_KEYS.reward(id)))
      );
      const availableRewards = rewards
        .filter((r): r is string => r !== null)
        .map(r => JSON.parse(r))
        .filter((r: Reward) => r.isActive && stampCount >= r.stampsRequired);
      
      if (availableRewards.length > 0) {
        redemptionPropensity = 0.9;
        break;
      }
    }
    
    // Churn risk: Based on recency and engagement
    let churnRisk = 0.2;
    if (features.recency > 30) churnRisk = 0.7;
    else if (features.recency > 60) churnRisk = 0.9;
    
    if (features.openRate < 0.2) churnRisk += 0.2;
    if (features.visitFrequency < 0.5) churnRisk += 0.2;
    churnRisk = Math.min(1, churnRisk);
    
    return {
      userId,
      visitPropensity,
      redemptionPropensity,
      churnRisk,
      basketSizeUplift: 0.15, // TODO: Calculate from model
      frequencyUplift: 0.25,  // TODO: Calculate from model
      calculatedAt: new Date().toISOString(),
      modelVersion: '1.0.0-simple',
    };
  }
  
  /**
   * Generate personalisation tags
   */
  private generatePersonalisationTags(
    features: UserFeatures,
    propensity: PropensityScores
  ): string[] {
    const tags: string[] = [];
    
    if (features.visitFrequency > 3) tags.push('frequent_visitor');
    if (features.recency <= 7) tags.push('recent_visitor');
    if (features.streakDays >= 7) tags.push('streak_master');
    if (propensity.churnRisk > 0.6) tags.push('at_risk');
    if (propensity.visitPropensity > 0.7) tags.push('likely_visit');
    if (features.categoryAffinity['cafe'] > 0.7) tags.push('coffee_lover');
    if (features.categoryAffinity['restaurant'] > 0.7) tags.push('foodie');
    
    return tags;
  }
  
  /**
   * Predict next best visit day
   */
  private predictNextVisitDay(
    features: UserFeatures,
    context: ContextualSignals
  ): string {
    // Simple prediction: If frequent visitor, predict 2-3 days from now
    // If infrequent, predict based on average interval
    
    const avgInterval = features.visitFrequency > 0 
      ? 7 / features.visitFrequency 
      : 14;
    
    const nextVisit = new Date();
    nextVisit.setDate(nextVisit.getDate() + Math.ceil(avgInterval));
    
    return nextVisit.toISOString().split('T')[0];
  }
  
  // ============================================
  // HELPER METHODS
  // ============================================
  
  private async findTimeBasedRewards(
    businessIds: string[],
    timeSlot: 'breakfast' | 'lunch' | 'dinner'
  ): Promise<Reward[]> {
    // TODO: Implement time-based reward filtering
    return [];
  }
  
  private async findNearbyBusinesses(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<Business[]> {
    // TODO: Implement geospatial search
    // For now, return empty array
    return [];
  }
}

export const personalisationService = new PersonalisationService();

