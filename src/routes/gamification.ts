import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, REDIS_KEYS, redisClient } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

const router = Router();

// Achievement definitions
const ACHIEVEMENTS = {
  FIRST_STAMP: { id: 'first_stamp', name: 'First Steps', description: 'Collect your first stamp', icon: '🎯', points: 10 },
  TEN_STAMPS: { id: 'ten_stamps', name: 'Regular', description: 'Collect 10 stamps', icon: '⭐', points: 50 },
  FIFTY_STAMPS: { id: 'fifty_stamps', name: 'Loyal Customer', description: 'Collect 50 stamps', icon: '🌟', points: 200 },
  HUNDRED_STAMPS: { id: 'hundred_stamps', name: 'Super Fan', description: 'Collect 100 stamps', icon: '💎', points: 500 },
  FIRST_REDEMPTION: { id: 'first_redemption', name: 'Winner Winner', description: 'Redeem your first reward', icon: '🎁', points: 25 },
  FIVE_BUSINESSES: { id: 'five_businesses', name: 'Explorer', description: 'Visit 5 different businesses', icon: '🗺️', points: 100 },
  FIRST_REFERRAL: { id: 'first_referral', name: 'Connector', description: 'Refer your first friend', icon: '🤝', points: 75 },
  TEN_REFERRALS: { id: 'ten_referrals', name: 'Ambassador', description: 'Refer 10 friends', icon: '🏆', points: 500 },
  SOCIAL_SHARER: { id: 'social_sharer', name: 'Social Butterfly', description: 'Share on social media 5 times', icon: '📣', points: 50 },
  WEEKLY_STREAK: { id: 'weekly_streak', name: 'Consistent', description: 'Collect stamps 7 days in a row', icon: '🔥', points: 100 },
  EARLY_BIRD: { id: 'early_bird', name: 'Early Adopter', description: 'Join in the first month', icon: '🐦', points: 150 },
};

// GET /api/v1/gamification/leaderboard
router.get('/leaderboard', asyncHandler(async (req: Request, res: Response) => {
  const { type = 'stamps', limit = '10', period = 'all' } = req.query;
  
  const limitNum = parseInt(limit as string) || 10;
  let leaderboardKey: string;
  
  switch (type) {
    case 'stamps':
      leaderboardKey = REDIS_KEYS.leaderboard('stamps');
      break;
    case 'redemptions':
      leaderboardKey = REDIS_KEYS.leaderboard('redemptions');
      break;
    case 'referrals':
      leaderboardKey = REDIS_KEYS.leaderboard('referrals');
      break;
    default:
      leaderboardKey = REDIS_KEYS.leaderboard('stamps');
  }
  
  // Get top members from sorted set
  const topMembers = await redisClient.zrevrange(leaderboardKey, 0, limitNum - 1, 'WITHSCORES');
  
  // Format as array of objects with member details
  const leaderboard = [];
  for (let i = 0; i < topMembers.length; i += 2) {
    const memberId = topMembers[i];
    const score = parseInt(topMembers[i + 1]);
    
    const member = await redis.getMember(memberId);
    if (member) {
      leaderboard.push({
        rank: Math.floor(i / 2) + 1,
        memberId,
        firstName: member.firstName,
        lastName: member.lastName?.[0] + '.' || '', // Privacy: show only initial
        score,
        badges: member.achievements?.slice(0, 3) || [],
      });
    }
  }
  
  res.json({
    success: true,
    data: {
      type,
      period,
      leaderboard,
      lastUpdated: new Date().toISOString(),
    },
  });
}));

// GET /api/v1/gamification/achievements/:memberId
router.get('/achievements/:memberId', asyncHandler(async (req: Request, res: Response) => {
  const { memberId } = req.params;
  
  const member = await redis.getMember(memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  const earnedAchievements = member.achievements || [];
  const allAchievements = Object.values(ACHIEVEMENTS);
  
  // Calculate progress for un-earned achievements
  const progress: Record<string, number> = {};
  
  // Get member stats for progress calculation
  const totalStamps = member.totalStamps || 0;
  const totalRedemptions = member.totalRedemptions || 0;
  const businessCount = await redisClient.scard(`member:${memberId}:businesses`);
  const referralCount = await redisClient.scard(`member:${memberId}:referrals`);
  const shareCount = parseInt(await redisClient.get(`member:${memberId}:shares`) || '0');
  
  progress['first_stamp'] = totalStamps >= 1 ? 100 : 0;
  progress['ten_stamps'] = Math.min(100, (totalStamps / 10) * 100);
  progress['fifty_stamps'] = Math.min(100, (totalStamps / 50) * 100);
  progress['hundred_stamps'] = Math.min(100, (totalStamps / 100) * 100);
  progress['first_redemption'] = totalRedemptions >= 1 ? 100 : 0;
  progress['five_businesses'] = Math.min(100, (businessCount / 5) * 100);
  progress['first_referral'] = referralCount >= 1 ? 100 : 0;
  progress['ten_referrals'] = Math.min(100, (referralCount / 10) * 100);
  progress['social_sharer'] = Math.min(100, (shareCount / 5) * 100);
  
  res.json({
    success: true,
    data: {
      earned: earnedAchievements,
      available: allAchievements.filter(a => !earnedAchievements.includes(a.id)),
      progress,
      totalPoints: earnedAchievements.reduce((sum: number, id: string) => {
        const achievement = allAchievements.find(a => a.id === id);
        return sum + (achievement?.points || 0);
      }, 0),
    },
  });
}));

// GET /api/v1/gamification/rank/:memberId
router.get('/rank/:memberId', asyncHandler(async (req: Request, res: Response) => {
  const { memberId } = req.params;
  
  const member = await redis.getMember(memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  // Get rank from stamps leaderboard
  const rank = await redisClient.zrevrank(REDIS_KEYS.leaderboard('stamps'), memberId);
  const totalMembers = await redisClient.zcard(REDIS_KEYS.leaderboard('stamps'));
  
  // Calculate percentile
  const percentile = rank !== null 
    ? Math.round(((totalMembers - rank) / totalMembers) * 100) 
    : 0;
  
  res.json({
    success: true,
    data: {
      memberId,
      rank: rank !== null ? rank + 1 : null,
      totalMembers,
      percentile,
      stats: {
        totalStamps: member.totalStamps || 0,
        totalRedemptions: member.totalRedemptions || 0,
        referrals: await redisClient.scard(`member:${memberId}:referrals`),
        achievementPoints: (member.achievements || []).reduce((sum: number, id: string) => {
          const achievement = Object.values(ACHIEVEMENTS).find(a => a.id === id);
          return sum + (achievement?.points || 0);
        }, 0),
      },
    },
  });
}));

// POST /api/v1/gamification/social-share
router.post('/social-share', asyncHandler(async (req: Request, res: Response) => {
  const { memberId, platform, businessId } = req.body;
  
  if (!memberId || !platform) {
    throw new ApiError(400, 'Member ID and platform are required');
  }
  
  const member = await redis.getMember(memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  // Increment share count
  const shareKey = `member:${memberId}:shares`;
  const newShareCount = await redisClient.incr(shareKey);
  
  // Award points for sharing
  const pointsPerShare = 5;
  await redisClient.zincrby(REDIS_KEYS.leaderboard('stamps'), pointsPerShare, memberId);
  
  // Check for social sharer achievement
  if (newShareCount === 5) {
    const achievements = member.achievements || [];
    if (!achievements.includes('social_sharer')) {
      achievements.push('social_sharer');
      await redis.setMember(memberId, {
        ...member,
        achievements,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  
  // If business was shared, track it
  if (businessId) {
    await redisClient.incr(`business:${businessId}:shares`);
  }
  
  res.json({
    success: true,
    data: {
      points: pointsPerShare,
      newShareCount,
      achievement: newShareCount === 5 ? ACHIEVEMENTS.SOCIAL_SHARER : null,
    },
  });
}));

// GET /api/v1/gamification/referral/:memberId
router.get('/referral/:memberId', asyncHandler(async (req: Request, res: Response) => {
  const { memberId } = req.params;
  
  const member = await redis.getMember(memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  // Get or create referral code
  let referralCode = member.referralCode;
  if (!referralCode) {
    referralCode = `CC${memberId.substring(0, 6).toUpperCase()}`;
    await redis.setMember(memberId, {
      ...member,
      referralCode,
    });
  }
  
  const totalReferrals = await redisClient.scard(`member:${memberId}:referrals`);
  const pendingRewards = await redisClient.scard(`member:${memberId}:pending_referral_rewards`);
  
  res.json({
    success: true,
    data: {
      code: referralCode,
      totalReferrals,
      pendingRewards,
      rewardPerReferral: '1 bonus stamp at any business',
    },
  });
}));

// POST /api/v1/gamification/referral
router.post('/referral', asyncHandler(async (req: Request, res: Response) => {
  const { referralCode, newMemberId } = req.body;
  
  if (!referralCode || !newMemberId) {
    throw new ApiError(400, 'Referral code and new member ID are required');
  }
  
  // Find referrer by code
  const memberKeys = await redisClient.keys('member:*');
  let referrer = null;
  
  for (const key of memberKeys) {
    if (key.includes(':stamps') || key.includes(':businesses')) continue;
    const data = await redisClient.get(key);
    if (data) {
      const member = JSON.parse(data);
      if (member.referralCode === referralCode.toUpperCase()) {
        referrer = member;
        break;
      }
    }
  }
  
  if (!referrer) {
    throw new ApiError(404, 'Invalid referral code');
  }
  
  // Check if new member already exists
  const newMember = await redis.getMember(newMemberId);
  if (!newMember) {
    throw new ApiError(404, 'New member not found');
  }
  
  // Check if already referred
  const alreadyReferred = await redisClient.sismember(`member:${referrer.id}:referrals`, newMemberId);
  if (alreadyReferred) {
    throw new ApiError(400, 'This member has already been referred');
  }
  
  // Add referral
  await redisClient.sadd(`member:${referrer.id}:referrals`, newMemberId);
  
  // Update leaderboard
  await redisClient.zincrby(REDIS_KEYS.leaderboard('referrals'), 1, referrer.id);
  
  // Award bonus points to referrer
  await redisClient.zincrby(REDIS_KEYS.leaderboard('stamps'), 10, referrer.id);
  
  // Check for referral achievements
  const referralCount = await redisClient.scard(`member:${referrer.id}:referrals`);
  const achievements = referrer.achievements || [];
  
  if (referralCount === 1 && !achievements.includes('first_referral')) {
    achievements.push('first_referral');
  }
  if (referralCount === 10 && !achievements.includes('ten_referrals')) {
    achievements.push('ten_referrals');
  }
  
  if (achievements !== referrer.achievements) {
    await redis.setMember(referrer.id, {
      ...referrer,
      achievements,
      updatedAt: new Date().toISOString(),
    });
  }
  
  res.json({
    success: true,
    data: {
      referrer: {
        id: referrer.id,
        firstName: referrer.firstName,
        newReferralCount: referralCount,
      },
      reward: {
        type: 'bonus_points',
        amount: 10,
        message: 'Thanks for referring a friend!',
      },
    },
  });
}));

export default router;

