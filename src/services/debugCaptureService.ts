/**
 * Debug Capture Service
 * Captures client uploads and server downloads to /tmp for debugging
 */

import * as fs from 'fs';
import * as path from 'path';

const DEBUG_DIR = '/tmp/canny-carrot-debug';
const CLIENT_UPLOAD_DIR = path.join(DEBUG_DIR, 'client-uploads');
const SERVER_DOWNLOAD_DIR = path.join(DEBUG_DIR, 'server-downloads');

// Ensure directories exist
const ensureDirectory = (dirPath: string): void => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (error: any) {
    console.error(`[DEBUG] Failed to create directory ${dirPath}:`, error.message);
  }
};

// Initialize directories on first use
const initDirectories = (): void => {
  ensureDirectory(DEBUG_DIR);
  ensureDirectory(CLIENT_UPLOAD_DIR);
  ensureDirectory(SERVER_DOWNLOAD_DIR);
};

/**
 * Capture client upload (data being sent TO Redis)
 */
export const captureClientUpload = async (
  entityType: 'reward' | 'campaign' | 'business',
  businessId: string,
  data: any
): Promise<void> => {
  try {
    initDirectories();
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `client-upload-${entityType}-${businessId}-${timestamp}.json`;
    const filepath = path.join(CLIENT_UPLOAD_DIR, filename);
    
    const capture = {
      timestamp: new Date().toISOString(),
      direction: 'client-to-redis',
      entityType,
      businessId,
      data,
    };
    
    fs.writeFileSync(filepath, JSON.stringify(capture, null, 2));
    console.log(`📤 [DEBUG] Captured client upload: ${filepath}`);
  } catch (error: any) {
    console.error(`[DEBUG] Error capturing client upload:`, error.message);
    // Don't throw - debug capture shouldn't break functionality
  }
};

/**
 * Capture server download (data being sent FROM Redis to client)
 */
export const captureServerDownload = async (
  entityType: 'reward' | 'campaign' | 'business' | 'rewards' | 'campaigns',
  businessId: string,
  data: any
): Promise<void> => {
  try {
    initDirectories();
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `server-download-${entityType}-${businessId}-${timestamp}.json`;
    const filepath = path.join(SERVER_DOWNLOAD_DIR, filename);
    
    const capture = {
      timestamp: new Date().toISOString(),
      direction: 'redis-to-client',
      entityType,
      businessId,
      data,
    };
    
    fs.writeFileSync(filepath, JSON.stringify(capture, null, 2));
    console.log(`📥 [DEBUG] Captured server download: ${filepath}`);
  } catch (error: any) {
    console.error(`[DEBUG] Error capturing server download:`, error.message);
    // Don't throw - debug capture shouldn't break functionality
  }
};

/**
 * Get all client upload captures for a business
 */
export const getClientUploads = (businessId: string): string[] => {
  try {
    if (!fs.existsSync(CLIENT_UPLOAD_DIR)) {
      return [];
    }
    return fs.readdirSync(CLIENT_UPLOAD_DIR)
      .filter(f => f.includes(businessId))
      .map(f => path.join(CLIENT_UPLOAD_DIR, f));
  } catch (error) {
    return [];
  }
};

/**
 * Get all server download captures for a business
 */
export const getServerDownloads = (businessId: string): string[] => {
  try {
    if (!fs.existsSync(SERVER_DOWNLOAD_DIR)) {
      return [];
    }
    return fs.readdirSync(SERVER_DOWNLOAD_DIR)
      .filter(f => f.includes(businessId))
      .map(f => path.join(SERVER_DOWNLOAD_DIR, f));
  } catch (error) {
    return [];
  }
};

