/**
 * Canny Carrot Customer Record — Redis schema
 *
 * Canonical type for the document stored at `customer:{id}`.
 * See docs/CUSTOMER_RECORD_SCHEMA.md.
 */

export interface CustomerRecordPreferences {
  notifications?: boolean;
  push?: boolean;
  email?: boolean;
  sms?: boolean;
  marketing?: boolean;
  geofencing?: boolean;
}

export interface CustomerRecordRewardItem {
  id: string;
  name: string;
  count: number;
  total: number;
  icon?: string;
  pointsEarned: number;
  requirement?: number;
  pointsPerPurchase?: number;
  rewardType?: 'free_product' | 'discount' | 'other';
  businessId?: string;
  businessName?: string;
  businessLogo?: string;
  qrCode?: string;
  pinCode?: string;
  selectedProducts?: string[];
  selectedActions?: string[];
  collectedItems?: { itemType: string; itemName: string }[];
  createdAt?: string;
  lastScannedAt?: string;
  isEarned?: boolean;
  type?: 'product' | 'action';
  startDate?: string;
  endDate?: string;
}

/** Full customer record stored at `customer:{id}`. Account + rewards array. */
export interface CustomerRecord {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  preferences?: CustomerRecordPreferences;
  totalStamps?: number;
  totalRedemptions?: number;
  dateOfBirth?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  homeRegion?: string;
  deletedAt?: string;
  favoriteBusiness?: string;
  achievements?: string[];
  referralCode?: string;
  referredBy?: string;
  deviceTokens?: Array<{
    platform: 'ios' | 'android' | 'web';
    token: string;
    deviceId?: string;
    lastActiveAt?: string;
  }>;
  rewards: CustomerRecordRewardItem[];
  /** Transaction log: SCAN (what was scanned), EDIT (what changed), ACTION (e.g. redeem). Capped at 300. */
  transactionLog?: { timestamp: string; action: string; data: Record<string, unknown> }[];
}
