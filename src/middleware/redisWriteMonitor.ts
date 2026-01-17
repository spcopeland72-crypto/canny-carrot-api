/**
 * REDIS WRITE MONITOR - TEMPORARY DEBUG FEATURE
 * 
 * ⚠️ CRITICAL: REMOVE BEFORE PRODUCTION RELEASE ⚠️
 * 
 * Purpose: Monitor and block unauthorized Redis writes from apps
 * 
 * Rule: Redis writes from apps ONLY allowed during:
 *   1. Manual sync
 *   2. Logout
 *   3. Login update check
 * 
 * All other writes are BLOCKED and FLAGGED for debugging
 * 
 * Usage: Add X-Sync-Context header to requests:
 *   - "manual-sync" - Manual sync operation
 *   - "logout" - Logout operation
 *   - "login-check" - Login update check
 * 
 * If header is missing or invalid, write is BLOCKED and logged
 * 
 * Last Updated: 2026-01-17
 * Status: TEMPORARY - REMOVE BEFORE PRODUCTION
 */

import { Request, Response, NextFunction } from 'express';

const ALLOWED_CONTEXTS = ['manual-sync', 'logout', 'login-check'] as const;
type AllowedContext = typeof ALLOWED_CONTEXTS[number];

interface BlockedWriteLog {
  timestamp: string;
  endpoint: string;
  method: string;
  entityType: string;
  entityId: string;
  businessId?: string;
  context: string | null;
  blocked: boolean;
  reason?: string;
}

// Store blocked writes in memory (for debugging)
const blockedWrites: BlockedWriteLog[] = [];
const MAX_BLOCKED_LOGS = 100; // Keep last 100 blocked writes

/**
 * Get blocked writes log (for debugging)
 */
export const getBlockedWrites = (): BlockedWriteLog[] => {
  return [...blockedWrites];
};

/**
 * Clear blocked writes log
 */
export const clearBlockedWrites = (): void => {
  blockedWrites.length = 0;
};

/**
 * Middleware to monitor and block unauthorized Redis writes
 * 
 * Rule: Redis writes FROM THE APPS only allowed during sync/logout/login
 * Website/API-originated writes (business/customer creation) are ALWAYS allowed
 */
export const redisWriteMonitor = (entityType: 'business' | 'reward' | 'campaign') => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only monitor PUT and POST (writes)
    if (req.method !== 'PUT' && req.method !== 'POST') {
      return next();
    }

    // EXEMPT: Business creation from website (POST /api/v1/businesses without ID = new registration)
    // These are website/API-originated, not app-originated, so always allowed
    if (req.method === 'POST' && entityType === 'business' && !req.params.id) {
      // Business creation/registration from website - always allowed
      console.log(`✅ [REDIS WRITE MONITOR] Allowed: Business creation from website/API`);
      return next();
    }

    // EXEMPT: Customer creation from website (handled separately, not monitored)
    // Customer routes don't use this monitor, so they're always allowed

    // Debug: Log all headers to see what we're receiving
    const allHeaders = Object.keys(req.headers).map(key => `${key}: ${req.headers[key]}`).join(', ');
    console.log(`🔍 [REDIS WRITE MONITOR] Request headers: ${allHeaders.substring(0, 500)}`);
    
    // Try both lowercase and original case (Express normalizes to lowercase)
    const context = (req.headers['x-sync-context'] || req.headers['X-Sync-Context']) as string | undefined;
    console.log(`🔍 [REDIS WRITE MONITOR] Extracted context: ${context || 'MISSING'}`);
    console.log(`🔍 [REDIS WRITE MONITOR] All header keys: ${Object.keys(req.headers).join(', ')}`);
    const entityId = req.params.id || req.body.id || 'unknown';
    const businessId = req.body.businessId || req.params.businessId || 'unknown';
    const endpoint = req.path;
    const method = req.method;

    // Check if context is valid
    const isValidContext = context && ALLOWED_CONTEXTS.includes(context as AllowedContext);

    const logEntry: BlockedWriteLog = {
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      entityType,
      entityId,
      businessId: businessId !== 'unknown' ? businessId : undefined,
      context: context || null,
      blocked: !isValidContext,
      reason: !context 
        ? 'Missing X-Sync-Context header' 
        : !isValidContext 
          ? `Invalid context: ${context}. Allowed: ${ALLOWED_CONTEXTS.join(', ')}`
          : undefined,
    };

    if (!isValidContext) {
      // BLOCK THE WRITE
      blockedWrites.push(logEntry);
      
      // Keep only last N entries
      if (blockedWrites.length > MAX_BLOCKED_LOGS) {
        blockedWrites.shift();
      }

      // Log the blocked write
      console.error('\n' + '='.repeat(80));
      console.error('🚫 [REDIS WRITE MONITOR] BLOCKED UNAUTHORIZED WRITE');
      console.error('='.repeat(80));
      console.error(`   Entity Type: ${entityType}`);
      console.error(`   Entity ID: ${entityId}`);
      console.error(`   Business ID: ${businessId}`);
      console.error(`   Endpoint: ${method} ${endpoint}`);
      console.error(`   Context Header: ${context || 'MISSING'}`);
      console.error(`   Reason: ${logEntry.reason}`);
      console.error(`   Timestamp: ${logEntry.timestamp}`);
      console.error('='.repeat(80) + '\n');

      // Return error response
      return res.status(403).json({
        success: false,
        error: 'Redis write blocked - unauthorized context',
        message: `Redis writes from apps are ONLY allowed during manual sync, logout, or login update check.`,
        details: {
          entityType,
          entityId,
          context: context || 'missing',
          allowedContexts: ALLOWED_CONTEXTS,
          reason: logEntry.reason,
        },
        debug: {
          endpoint,
          method,
          timestamp: logEntry.timestamp,
        },
      });
    }

    // Write is allowed - log for debugging
    console.log(`✅ [REDIS WRITE MONITOR] Allowed write: ${entityType} ${entityId} (context: ${context})`);
    
    next();
  };
};

/**
 * GET endpoint to view blocked writes (for debugging)
 * GET /api/v1/debug/blocked-writes
 */
export const getBlockedWritesHandler = async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      blockedWrites: getBlockedWrites(),
      count: blockedWrites.length,
      allowedContexts: ALLOWED_CONTEXTS,
    },
  });
};

