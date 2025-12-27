// AI Personalization Routes
// Provides personalized recommendations and insights

import { Router, Request, Response } from 'express';
import { personalisationService } from '../services/personalisation.service';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { ContextualSignals } from '../types/ai';

const router = Router();

/**
 * GET /api/v1/personalisation/user/:userId
 * Get personalized recommendations for a user
 * 
 * Query params:
 * - context: JSON string with contextual signals
 * - limit: Number of recommendations (default: 5)
 */
router.get('/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { context: contextStr, limit = '5' } = req.query;
  
  // Parse context or create default
  let context: ContextualSignals;
  if (contextStr) {
    try {
      context = JSON.parse(contextStr as string);
    } catch {
      throw new ApiError(400, 'Invalid context JSON');
    }
  } else {
    // Default context
    const now = new Date();
    context = {
      timestamp: now.toISOString(),
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      channel: 'in_app',
    };
  }
  
  // Get recommendations
  const recommendations = await personalisationService.getRecommendations(userId, context);
  
  // Limit results
  recommendations.recommendedActions = recommendations.recommendedActions.slice(
    0,
    parseInt(limit as string, 10)
  );
  
  res.json({
    success: true,
    data: recommendations,
  });
}));

/**
 * GET /api/v1/personalisation/user/:userId/features
 * Get calculated user features (for debugging/analytics)
 */
router.get('/user/:userId/features', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  const features = await personalisationService.calculateUserFeatures(userId);
  
  res.json({
    success: true,
    data: features,
  });
}));

/**
 * GET /api/v1/personalisation/user/:userId/propensity
 * Get propensity scores for a user
 */
router.get('/user/:userId/propensity', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  const features = await personalisationService.calculateUserFeatures(userId);
  const propensity = await (personalisationService as any).calculatePropensityScores(userId, features);
  
  res.json({
    success: true,
    data: propensity,
  });
}));

/**
 * GET /api/v1/personalisation/business/:businessId/recommendations
 * Get AI recommendations for a business
 */
router.get('/business/:businessId/recommendations', asyncHandler(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  
  // TODO: Implement merchant AI recommendations
  // For now, return placeholder
  
  res.json({
    success: true,
    data: {
      recommendations: [
        {
          id: 'rec_1',
          type: 'campaign',
          title: 'Launch Lunchtime Double Points',
          description: 'Offer 2x stamps during lunch hours (12-2pm) to increase midday traffic',
          reasoning: 'Your lunchtime visits are 40% lower than peak hours. Double points could increase visits by 25%.',
          expectedImpact: {
            visits: 15,
            revenue: 450,
            confidence: 0.78,
          },
          action: {
            type: 'create_campaign',
            parameters: {
              type: 'double_stamps',
              timeRange: { start: '12:00', end: '14:00' },
              daysOfWeek: [1, 2, 3, 4, 5],
            },
          },
          priority: 0.85,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'rec_2',
          type: 'segment',
          title: 'Re-engage At-Risk Customers',
          description: '150 customers haven\'t visited in 30+ days. Send them a welcome-back offer.',
          reasoning: 'These customers have a 65% churn risk. A targeted campaign could recover 30% of them.',
          expectedImpact: {
            visits: 45,
            revenue: 1350,
            confidence: 0.72,
          },
          action: {
            type: 'create_campaign',
            parameters: {
              targetAudience: 'inactive',
              type: 'bonus_reward',
              bonusStamps: 2,
            },
          },
          priority: 0.80,
          createdAt: new Date().toISOString(),
        },
      ],
    },
  });
}));

export default router;


















