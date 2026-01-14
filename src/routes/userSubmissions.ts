/**
 * User Submissions Route
 * POST /api/v1/user-submissions
 * 
 * Captures user-entered data (business names, sectors, locations) for admin review
 */

import { Router, Request, Response } from 'express';
import { redisClient, connectRedis } from '../config/redis';
import { asyncHandler } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface UserSubmissionRequest {
  fieldType: 'businessName' | 'sector' | 'country' | 'region' | 'city' | 'street' | 'postcode';
  enteredValue: string;
  context?: Record<string, any>;
  userId: string;
  sessionId: string;
}

interface UserSubmissionResponse {
  id: string;
  status: string;
  message: string;
}

/**
 * POST /api/v1/user-submissions
 * Submit a user entry for admin review
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  await connectRedis();

  const {
    fieldType,
    enteredValue,
    context,
    userId,
    sessionId,
  } = req.body as UserSubmissionRequest;

  // Validation
  if (!fieldType || !enteredValue || !userId || !sessionId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: fieldType, enteredValue, userId, sessionId',
    });
  }

  // Generate submission ID
  const submissionId = uuidv4();

  // Create submission object
  const submission = {
    id: submissionId,
    fieldType,
    enteredValue,
    context: context || {},
    userId,
    sessionId,
    timestamp: new Date().toISOString(),
    status: 'pending',
  };

  // Store in Redis
  // Use a key pattern: user-submission:{id}
  const submissionKey = `user-submission:${submissionId}`;
  
  try {
    // Store individual submission
    await redisClient.set(submissionKey, JSON.stringify(submission));
    
    // Add to pending submissions list (for admin review)
    await redisClient.sadd('user-submissions:pending', submissionId);
    
    // Optionally: store by field type for easier filtering
    await redisClient.sadd(`user-submissions:${fieldType}`, submissionId);
    
    // Store by user ID for tracking
    await redisClient.sadd(`user-submissions:user:${userId}`, submissionId);

    console.log(`[USER-SUBMISSIONS] New submission stored: ${submissionId}`, {
      fieldType,
      enteredValue: enteredValue.substring(0, 50), // Log first 50 chars only
      userId,
      timestamp: submission.timestamp,
    });

    const response: UserSubmissionResponse = {
      id: submissionId,
      status: 'pending',
      message: 'Submission received and queued for admin review',
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('[USER-SUBMISSIONS] Error storing submission:', error);
    throw new Error(`Failed to store submission: ${error.message}`);
  }
}));

export default router;

