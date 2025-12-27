import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis, REDIS_KEYS, redisClient } from '../config/redis';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

const router = Router();

// POST /api/v1/notifications/register - Register device for push notifications
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { memberId, token, platform } = req.body;
  
  if (!memberId || !token || !platform) {
    throw new ApiError(400, 'Member ID, token, and platform are required');
  }
  
  if (!['ios', 'android', 'web'].includes(platform)) {
    throw new ApiError(400, 'Platform must be ios, android, or web');
  }
  
  const member = await redis.getMember(memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  const deviceKey = `member:${memberId}:devices`;
  const device = {
    token,
    platform,
    registeredAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
  };
  
  // Store device info (using hash with token as field)
  await redisClient.hset(deviceKey, token, JSON.stringify(device));
  
  res.json({
    success: true,
    message: 'Device registered for notifications',
  });
}));

// PUT /api/v1/notifications/preferences/:memberId
router.put('/preferences/:memberId', asyncHandler(async (req: Request, res: Response) => {
  const { memberId } = req.params;
  const { push, email, sms, marketing, geofencing } = req.body;
  
  const member = await redis.getMember(memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  const preferences = {
    push: push !== undefined ? push : member.preferences?.push ?? true,
    email: email !== undefined ? email : member.preferences?.email ?? true,
    sms: sms !== undefined ? sms : member.preferences?.sms ?? false,
    marketing: marketing !== undefined ? marketing : member.preferences?.marketing ?? false,
    geofencing: geofencing !== undefined ? geofencing : member.preferences?.geofencing ?? true,
  };
  
  await redis.setMember(memberId, {
    ...member,
    preferences,
    updatedAt: new Date().toISOString(),
  });
  
  res.json({
    success: true,
    data: preferences,
  });
}));

// GET /api/v1/notifications/history/:memberId
router.get('/history/:memberId', asyncHandler(async (req: Request, res: Response) => {
  const { memberId } = req.params;
  const { limit = '20', offset = '0' } = req.query;
  
  const member = await redis.getMember(memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  const historyKey = `member:${memberId}:notifications`;
  const notifications = await redisClient.lrange(
    historyKey,
    parseInt(offset as string),
    parseInt(offset as string) + parseInt(limit as string) - 1
  );
  
  const parsedNotifications = notifications.map(n => JSON.parse(n));
  
  res.json({
    success: true,
    data: parsedNotifications,
    meta: {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      total: await redisClient.llen(historyKey),
    },
  });
}));

// POST /api/v1/notifications/send - Send notification to a member (internal use / testing)
router.post('/send', asyncHandler(async (req: Request, res: Response) => {
  const { memberId, title, message, data, type = 'general' } = req.body;
  
  if (!memberId || !title || !message) {
    throw new ApiError(400, 'Member ID, title, and message are required');
  }
  
  const member = await redis.getMember(memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  // Check preferences
  if (!member.preferences?.push) {
    return res.json({
      success: true,
      message: 'Member has disabled push notifications',
      sent: false,
    });
  }
  
  const notification = {
    id: uuidv4(),
    type,
    title,
    message,
    data: data || {},
    createdAt: new Date().toISOString(),
    read: false,
  };
  
  // Store in member's notification history
  const historyKey = `member:${memberId}:notifications`;
  await redisClient.lpush(historyKey, JSON.stringify(notification));
  
  // Trim to last 100 notifications
  await redisClient.ltrim(historyKey, 0, 99);
  
  // Queue for sending via push service
  await redisClient.lpush('notifications:pending', JSON.stringify({
    ...notification,
    memberId,
  }));
  
  // In production, you would integrate with Firebase Cloud Messaging or similar here
  // For now, we just queue and acknowledge
  
  res.json({
    success: true,
    data: notification,
    sent: true,
  });
}));

// POST /api/v1/notifications/broadcast - Send to all members of a business
router.post('/broadcast', asyncHandler(async (req: Request, res: Response) => {
  const { businessId, title, message, data, targetAudience = 'all' } = req.body;
  
  if (!businessId || !title || !message) {
    throw new ApiError(400, 'Business ID, title, and message are required');
  }
  
  const business = await redis.getBusiness(businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  const memberIds = await redisClient.smembers(REDIS_KEYS.businessMembers(businessId));
  
  let queuedCount = 0;
  
  for (const memberId of memberIds) {
    const member = await redis.getMember(memberId);
    if (member && member.preferences?.push) {
      const notification = {
        id: uuidv4(),
        type: 'business_broadcast',
        businessId,
        businessName: business.name,
        title,
        message,
        data: data || {},
        createdAt: new Date().toISOString(),
        read: false,
      };
      
      await redisClient.lpush(`member:${memberId}:notifications`, JSON.stringify(notification));
      await redisClient.ltrim(`member:${memberId}:notifications`, 0, 99);
      
      await redisClient.lpush('notifications:pending', JSON.stringify({
        ...notification,
        memberId,
      }));
      
      queuedCount++;
    }
  }
  
  res.json({
    success: true,
    message: `Notification queued for ${queuedCount} members`,
    totalMembers: memberIds.length,
    queuedCount,
  });
}));

// POST /api/v1/notifications/geofence - Handle geofence trigger
router.post('/geofence', asyncHandler(async (req: Request, res: Response) => {
  const { memberId, businessId, action } = req.body;
  
  if (!memberId || !businessId || !action) {
    throw new ApiError(400, 'Member ID, business ID, and action are required');
  }
  
  if (!['enter', 'exit'].includes(action)) {
    throw new ApiError(400, 'Action must be enter or exit');
  }
  
  const member = await redis.getMember(memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }
  
  const business = await redis.getBusiness(businessId);
  if (!business) {
    throw new ApiError(404, 'Business not found');
  }
  
  // Check if geofencing is enabled for this member
  if (!member.preferences?.geofencing) {
    return res.json({
      success: true,
      message: 'Geofencing disabled for this member',
      notificationSent: false,
    });
  }
  
  // Log geofence event
  const event = {
    memberId,
    businessId,
    action,
    timestamp: new Date().toISOString(),
  };
  await redisClient.lpush(`geofence:events`, JSON.stringify(event));
  
  let notification = null;
  
  if (action === 'enter') {
    // Check if there are any active offers
    const campaignIds = await redisClient.smembers(`business:${businessId}:campaigns`);
    let activeOffer = null;
    
    for (const campaignId of campaignIds) {
      const data = await redisClient.get(REDIS_KEYS.campaign(campaignId));
      if (data) {
        const campaign = JSON.parse(data);
        if (campaign.status === 'active') {
          activeOffer = campaign;
          break;
        }
      }
    }
    
    // Get member's stamp count at this business
    const stampCount = await redis.getStampCount(memberId, businessId);
    
    // Craft personalized message
    let message = `You're near ${business.name}!`;
    if (activeOffer) {
      message = `${business.name} has a special offer: ${activeOffer.name}!`;
    } else if (stampCount > 0) {
      const rewardIds = await redisClient.smembers(REDIS_KEYS.businessRewards(businessId));
      for (const rewardId of rewardIds) {
        const rewardData = await redisClient.get(REDIS_KEYS.reward(rewardId));
        if (rewardData) {
          const reward = JSON.parse(rewardData);
          if (reward.isActive) {
            const remaining = reward.stampsRequired - stampCount;
            if (remaining > 0 && remaining <= 3) {
              message = `Only ${remaining} more stamps at ${business.name} for your free ${reward.name}!`;
            }
            break;
          }
        }
      }
    }
    
    notification = {
      id: uuidv4(),
      type: 'geofence_enter',
      businessId,
      businessName: business.name,
      title: `📍 ${business.name}`,
      message,
      data: {
        stampCount,
        activeOffer: activeOffer?.name,
      },
      createdAt: new Date().toISOString(),
      read: false,
    };
    
    // Don't spam - check if we sent a notification recently
    const lastNotifKey = `geofence:last:${memberId}:${businessId}`;
    const lastNotif = await redisClient.get(lastNotifKey);
    const now = Date.now();
    
    if (!lastNotif || now - parseInt(lastNotif) > 6 * 60 * 60 * 1000) { // 6 hours
      await redisClient.lpush(`member:${memberId}:notifications`, JSON.stringify(notification));
      await redisClient.set(lastNotifKey, now.toString(), 'EX', 6 * 60 * 60);
      
      await redisClient.lpush('notifications:pending', JSON.stringify({
        ...notification,
        memberId,
      }));
    } else {
      notification = null; // Suppressed
    }
  }
  
  res.json({
    success: true,
    data: {
      event,
      notification,
      notificationSent: notification !== null,
    },
  });
}));

// POST /api/v1/notifications/mark-read
router.post('/mark-read', asyncHandler(async (req: Request, res: Response) => {
  const { memberId, notificationIds } = req.body;
  
  if (!memberId || !notificationIds || !Array.isArray(notificationIds)) {
    throw new ApiError(400, 'Member ID and notification IDs array are required');
  }
  
  const historyKey = `member:${memberId}:notifications`;
  const notifications = await redisClient.lrange(historyKey, 0, -1);
  
  const updatedNotifications = notifications.map(n => {
    const notif = JSON.parse(n);
    if (notificationIds.includes(notif.id)) {
      notif.read = true;
      notif.readAt = new Date().toISOString();
    }
    return JSON.stringify(notif);
  });
  
  // Replace the list
  if (updatedNotifications.length > 0) {
    await redisClient.del(historyKey);
    await redisClient.rpush(historyKey, ...updatedNotifications);
  }
  
  res.json({
    success: true,
    message: `Marked ${notificationIds.length} notifications as read`,
  });
}));

// GET /api/v1/notifications/unread-count/:memberId
router.get('/unread-count/:memberId', asyncHandler(async (req: Request, res: Response) => {
  const { memberId } = req.params;
  
  const historyKey = `member:${memberId}:notifications`;
  const notifications = await redisClient.lrange(historyKey, 0, -1);
  
  const unreadCount = notifications.filter(n => {
    const notif = JSON.parse(n);
    return !notif.read;
  }).length;
  
  res.json({
    success: true,
    data: {
      unreadCount,
      totalCount: notifications.length,
    },
  });
}));

export default router;


















