/**
 * Debug Routes - For development/debugging only
 * ⚠️ REMOVE BEFORE PRODUCTION
 */

import express, { Request, Response } from 'express';

const router = express.Router();

// Store the last received local storage dump
let lastLocalStorageDump: any = null;
let lastDumpTimestamp: string | null = null;

/**
 * POST /api/v1/debug/local-storage
 * Accepts local storage contents from the app for debugging
 */
router.post('/local-storage', (req: Request, res: Response) => {
  try {
    const { businessId, campaigns, rewards, businessProfile, customers, syncMetadata } = req.body;
    
    lastLocalStorageDump = {
      businessId,
      campaigns: campaigns || [],
      rewards: rewards || [],
      businessProfile: businessProfile || null,
      customers: customers || [],
      syncMetadata: syncMetadata || null,
      timestamp: new Date().toISOString(),
    };
    lastDumpTimestamp = new Date().toISOString();
    
    console.log('\n' + '='.repeat(80));
    console.log('📦 [DEBUG] Local Storage Dump Received');
    console.log('='.repeat(80));
    console.log(`   Business ID: ${businessId || 'unknown'}`);
    console.log(`   Campaigns: ${campaigns?.length || 0}`);
    console.log(`   Rewards: ${rewards?.length || 0}`);
    console.log(`   Customers: ${customers?.length || 0}`);
    console.log(`   Business Profile: ${businessProfile ? 'Present' : 'Missing'}`);
    console.log('='.repeat(80) + '\n');
    
    if (campaigns && campaigns.length > 0) {
      console.log('📢 CAMPAIGNS IN LOCAL STORAGE:');
      campaigns.forEach((campaign: any, index: number) => {
        console.log(`   ${index + 1}. ${campaign.name || 'Unnamed'} (ID: ${campaign.id})`);
        console.log(`      Type: ${campaign.type || 'unknown'}`);
        console.log(`      Selected Products: ${campaign.selectedProducts?.length || 0} - ${JSON.stringify(campaign.selectedProducts || [])}`);
        console.log(`      Selected Actions: ${campaign.selectedActions?.length || 0} - ${JSON.stringify(campaign.selectedActions || [])}`);
        console.log(`      PIN Code: ${campaign.pinCode || 'none'}`);
        console.log(`      QR Code: ${campaign.qrCode ? 'Present' : 'Missing'}`);
        console.log(`      Updated: ${campaign.updatedAt || 'unknown'}`);
      });
      console.log('');
    }
    
    res.json({
      success: true,
      message: 'Local storage dump received',
      received: {
        campaigns: campaigns?.length || 0,
        rewards: rewards?.length || 0,
        customers: customers?.length || 0,
        hasBusinessProfile: !!businessProfile,
      },
    });
  } catch (error: any) {
    console.error('❌ [DEBUG] Error receiving local storage dump:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/debug/local-storage
 * Returns the last received local storage dump
 */
router.get('/local-storage', (req: Request, res: Response) => {
  if (!lastLocalStorageDump) {
    return res.json({
      success: false,
      message: 'No local storage dump received yet',
      instructions: 'POST to /api/v1/debug/local-storage with { businessId, campaigns, rewards, businessProfile, customers, syncMetadata }',
    });
  }
  
  res.json({
    success: true,
    timestamp: lastDumpTimestamp,
    data: lastLocalStorageDump,
  });
});

export default router;

