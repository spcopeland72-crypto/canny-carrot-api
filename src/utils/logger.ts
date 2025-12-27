/**
 * File-based logger for Redis operations and registration events
 * Logs all database operations to files for debugging and auditing
 */

import * as fs from 'fs';
import * as path from 'path';

// Detect if we're running on Vercel (read-only filesystem)
const IS_VERCEL = process.env.VERCEL === '1';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ENABLE_FILE_LOGGING = !IS_VERCEL && !IS_PRODUCTION;

const LOGS_DIR = ENABLE_FILE_LOGGING ? path.join(process.cwd(), 'logs') : '';
const REGISTRATION_LOG_FILE = ENABLE_FILE_LOGGING ? path.join(LOGS_DIR, 'registration.log') : '';
const REDIS_LOG_FILE = ENABLE_FILE_LOGGING ? path.join(LOGS_DIR, 'redis-operations.log') : '';
const ERROR_LOG_FILE = ENABLE_FILE_LOGGING ? path.join(LOGS_DIR, 'errors.log') : '';

// Ensure logs directory exists (only in development)
if (ENABLE_FILE_LOGGING && LOGS_DIR && !fs.existsSync(LOGS_DIR)) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  } catch (error) {
    // Silently fail if we can't create the directory
    console.warn('[Logger] Could not create logs directory, using console logging only');
  }
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  data?: any;
  error?: any;
}

function formatLogEntry(entry: LogEntry): string {
  const baseLog = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
  
  if (entry.data) {
    const dataStr = typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data, null, 2);
    return `${baseLog}\n${dataStr}\n`;
  }
  
  if (entry.error) {
    const errorStr = entry.error instanceof Error 
      ? `${entry.error.message}\n${entry.error.stack}` 
      : JSON.stringify(entry.error, null, 2);
    return `${baseLog}\n${errorStr}\n`;
  }
  
  return `${baseLog}\n`;
}

function writeLog(filePath: string, entry: LogEntry): void {
  // Skip file logging on Vercel or in production (read-only filesystem)
  if (!ENABLE_FILE_LOGGING || !filePath) {
    return;
  }
  
  try {
    const logLine = formatLogEntry(entry);
    fs.appendFileSync(filePath, logLine, 'utf8');
  } catch (error) {
    // Silently fail - console logging will still work
    // Don't log the error to avoid infinite loops
  }
}

export const logger = {
  /**
   * Log registration events (business/customer registration)
   */
  registration: {
    info: (message: string, data?: any) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message,
        data,
      };
      writeLog(REGISTRATION_LOG_FILE, entry);
      console.log(`📝 [REGISTRATION] ${message}`, data || '');
    },
    
    error: (message: string, error?: any, data?: any) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message,
        error,
        data,
      };
      writeLog(REGISTRATION_LOG_FILE, entry);
      writeLog(ERROR_LOG_FILE, entry); // Also write to error log
      console.error(`❌ [REGISTRATION] ${message}`, error || '', data || '');
    },
    
    warn: (message: string, data?: any) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'warn',
        message,
        data,
      };
      writeLog(REGISTRATION_LOG_FILE, entry);
      console.warn(`⚠️ [REGISTRATION] ${message}`, data || '');
    },
  },

  /**
   * Log Redis operations (SET, GET, SADD, SMEMBERS, etc.)
   */
  redis: {
    info: (message: string, data?: any) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message,
        data,
      };
      writeLog(REDIS_LOG_FILE, entry);
      console.log(`🔵 [REDIS] ${message}`, data || '');
    },
    
    error: (message: string, error?: any, data?: any) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message,
        error,
        data,
      };
      writeLog(REDIS_LOG_FILE, entry);
      writeLog(ERROR_LOG_FILE, entry);
      console.error(`❌ [REDIS] ${message}`, error || '', data || '');
    },
    
    debug: (message: string, data?: any) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'debug',
        message,
        data,
      };
      // Only write debug to file, not console (to reduce noise)
      writeLog(REDIS_LOG_FILE, entry);
    },
  },

  /**
   * Log general errors
   */
  error: (message: string, error?: any, data?: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      error,
      data,
    };
    writeLog(ERROR_LOG_FILE, entry);
    console.error(`❌ [ERROR] ${message}`, error || '', data || '');
  },
};

export default logger;

