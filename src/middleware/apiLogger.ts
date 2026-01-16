/**
 * Comprehensive API Request/Response Logger
 * Captures ALL API requests and responses to Vercel-accessible storage
 * 
 * This middleware logs:
 * - Request: method, path, headers, body, query params, timestamp, deviceId, businessId
 * - Response: status, headers, body, timestamp, response time
 * - Redis state: business.updatedAt timestamp when applicable
 * - All stored to /tmp for Vercel access
 */

import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { redis } from '../config/redis';

const LOG_DIR = '/tmp/canny-carrot-api-logs';
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024; // 10MB max per file
const MAX_LOG_FILES = 100; // Keep last 100 log files

// Ensure log directory exists
const ensureLogDirectory = (): void => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (error: any) {
    console.error(`[API LOGGER] Failed to create log directory:`, error.message);
  }
};

// Clean old log files
const cleanOldLogs = (): void => {
  try {
    if (!fs.existsSync(LOG_DIR)) return;
    
    const files = fs.readdirSync(LOG_DIR)
      .map(filename => ({
        filename,
        path: path.join(LOG_DIR, filename),
        time: fs.statSync(path.join(LOG_DIR, filename)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time); // Newest first
    
    // Keep only the newest MAX_LOG_FILES
    if (files.length > MAX_LOG_FILES) {
      files.slice(MAX_LOG_FILES).forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          // Ignore delete errors
        }
      });
    }
  } catch (error) {
    // Ignore cleanup errors
  }
};

// Sanitize sensitive data
const sanitizeData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  const sensitiveKeys = ['password', 'passwordHash', 'token', 'authorization', 'auth'];
  
  for (const key of sensitiveKeys) {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
};

// Get business timestamp from Redis (if applicable)
const getBusinessTimestamp = async (businessId?: string): Promise<string | null> => {
  if (!businessId) return null;
  
  try {
    const business = await redis.getBusiness(businessId);
    return business?.updatedAt || business?.profile?.updatedAt || null;
  } catch (error) {
    return null;
  }
};

// Extract businessId from request
const extractBusinessId = (req: Request): string | undefined => {
  // Try various locations
  return req.body?.businessId || 
         req.params?.id || 
         req.query?.businessId as string | undefined;
};

// API Logger Middleware
export const apiLogger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const timestamp = new Date().toISOString();
  
  // Capture request data
  const requestData = {
    requestId,
    timestamp,
    method: req.method,
    path: req.path,
    url: req.url,
    headers: sanitizeData(req.headers),
    query: req.query,
    body: sanitizeData(req.body),
    params: req.params,
    deviceId: req.body?.deviceId,
    businessId: extractBusinessId(req),
  };
  
  // Store original response methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalEnd = res.end.bind(res);
  
  // Capture response body
  let responseBody: any = null;
  
  // Override res.json
  res.json = function(body: any): Response {
    responseBody = body;
    return originalJson(body);
  };
  
  // Override res.send
  res.send = function(body: any): Response {
    responseBody = body;
    return originalSend(body);
  };
  
  // Override res.end to capture response after it's sent
  res.end = function(chunk?: any, encoding?: any): Response {
    // Log when response ends
    const responseTime = Date.now() - startTime;
    const responseData = {
      requestId,
      timestamp: new Date().toISOString(),
      responseTime,
      status: res.statusCode,
      headers: res.getHeaders(),
      body: sanitizeData(responseBody || chunk),
    };
    
    // Log to file asynchronously (don't block response)
    logRequestResponse(requestData, responseData).catch(err => {
      console.error('[API LOGGER] Error logging request/response:', err);
    });
    
    return originalEnd(chunk, encoding);
  };
  
  next();
};

// Log request and response to file
const logRequestResponse = async (
  requestData: any,
  responseData: any
): Promise<void> => {
  try {
    ensureLogDirectory();
    cleanOldLogs();
    
    // Get business timestamp if applicable
    const businessId = requestData.businessId;
    const redisTimestamp = businessId ? await getBusinessTimestamp(businessId) : null;
    
    // Create log entry
    const logEntry = {
      ...requestData,
      response: {
        ...responseData,
        redisTimestamp, // Include Redis business.updatedAt if applicable
      },
    };
    
    // Create filename with date and time
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const time = new Date().toISOString().split('T')[1].replace(/:/g, '-').split('.')[0]; // HH-MM-SS
    const filename = `api-${date}-${time}-${requestData.requestId}.json`;
    const filepath = path.join(LOG_DIR, filename);
    
    // Write log entry
    fs.writeFileSync(filepath, JSON.stringify(logEntry, null, 2));
    
    // Also append to daily log file (easier to search)
    const dailyLogFile = path.join(LOG_DIR, `api-${date}.log`);
    const logLine = JSON.stringify({
      requestId: requestData.requestId,
      timestamp: requestData.timestamp,
      method: requestData.method,
      path: requestData.path,
      businessId: requestData.businessId,
      deviceId: requestData.deviceId,
      status: responseData.status,
      responseTime: responseData.responseTime,
      redisTimestamp,
    }) + '\n';
    fs.appendFileSync(dailyLogFile, logLine);
    
    // Console log for Vercel function logs
    console.log(`📋 [API LOG] ${requestData.method} ${requestData.path} | Status: ${responseData.status} | Time: ${responseData.responseTime}ms | Business: ${businessId || 'N/A'} | Redis Timestamp: ${redisTimestamp || 'N/A'}`);
    
  } catch (error: any) {
    console.error('[API LOGGER] Error logging:', error.message);
    // Don't throw - logging shouldn't break API functionality
  }
};

// Get recent logs for a business
export const getBusinessLogs = (businessId: string, limit: number = 50): any[] => {
  try {
    if (!fs.existsSync(LOG_DIR)) return [];
    
    const date = new Date().toISOString().split('T')[0];
    const dailyLogFile = path.join(LOG_DIR, `api-${date}.log`);
    
    if (!fs.existsSync(dailyLogFile)) return [];
    
    const lines = fs.readFileSync(dailyLogFile, 'utf-8').split('\n').reverse(); // Newest first
    const logs: any[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const log = JSON.parse(line);
        if (log.businessId === businessId) {
          logs.push(log);
          if (logs.length >= limit) break;
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
    
    return logs;
  } catch (error) {
    return [];
  }
};

// Get all logs (for admin/debugging)
export const getAllLogs = (limit: number = 100): any[] => {
  try {
    if (!fs.existsSync(LOG_DIR)) return [];
    
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(LOG_DIR, f))
      .map(f => ({
        path: f,
        time: fs.statSync(f).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time) // Newest first
      .slice(0, limit);
    
    const logs: any[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(file.path, 'utf-8');
        const log = JSON.parse(content);
        logs.push(log);
      } catch (e) {
        // Skip invalid files
      }
    }
    
    return logs;
  } catch (error) {
    return [];
  }
};

