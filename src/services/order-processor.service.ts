// E-Commerce Order Processor Service
// Matches orders to members and issues stamps

import { v4 as uuidv4 } from 'uuid';
import { redisClient } from '../config/redis';
import { redis, REDIS_KEYS } from '../config/redis';
import { 
  EcommerceOrder, 
  EcommerceConnection,
  OrderProcessingResult,
  OrderProcessingStatus,
  ECOMMERCE_REDIS_KEYS 
} from '../types/ecommerce';
import { Member, Stamp, Business } from '../types';

export interface ProcessingContext {
  order: EcommerceOrder;
  connection: EcommerceConnection;
  business: Business;
}

interface MemberLookupResult {
  status: 'found' | 'not_found' | 'invited';
  member?: Member;
}

export class OrderProcessorService {
  
  // ============================================
  // MAIN PROCESSING FLOW
  // ============================================
  
  /**
   * Process an incoming e-commerce order
   */
  async processOrder(order: EcommerceOrder): Promise<OrderProcessingResult> {
    console.log(`📦 Processing order ${order.externalOrderId} from ${order.platform}`);
    
    try {
      // 1. Get connection and business
      const connection = await this.getConnection(order.connectionId);
      if (!connection) {
        return this.failOrder(order, 'Connection not found');
      }
      
      const business = await redis.getBusiness(order.businessId);
      if (!business) {
        return this.failOrder(order, 'Business not found');
      }
      
      const context: ProcessingContext = { order, connection, business };
      
      // 2. Check if order meets stamp criteria
      if (!this.meetsStampCriteria(context)) {
        return this.skipOrder(order, 'Does not meet stamp criteria');
      }
      
      // 3. Check if already processed (idempotency)
      const existingOrder = await this.getOrderByExternalId(order.platform, order.externalOrderId);
      if (existingOrder?.processingStatus === 'completed') {
        return {
          orderId: order.id,
          status: 'completed',
          memberId: existingOrder.memberId,
          stampId: existingOrder.stampId,
          message: 'Order already processed',
        };
      }
      
      // 4. Find or invite member
      const memberResult = await this.findOrInviteMember(order.customerEmail, context);
      
      if (memberResult.status === 'not_found') {
        // Send invitation and mark as invited
        await this.sendJoinInvitation(order.customerEmail, business);
        return this.inviteOrder(order, 'Invitation sent to customer');
      }
      
      if (memberResult.status === 'invited') {
        return this.inviteOrder(order, 'Customer already invited');
      }
      
      // 5. Issue stamp
      const stamp = await this.issueOnlineStamp(memberResult.member!, context);
      
      // 6. Update order record
      await this.markOrderCompleted(order, memberResult.member!.id, stamp.id);
      
      // 7. Send notification to member
      await this.notifyMember(memberResult.member!, business, stamp, order);
      
      // 8. Update connection sync stats
      await this.updateSyncStats(connection.id, true);
      
      console.log(`✅ Order ${order.externalOrderId} processed - Stamp ${stamp.id} issued to member ${memberResult.member!.id}`);
      
      return {
        orderId: order.id,
        status: 'completed',
        memberId: memberResult.member!.id,
        stampId: stamp.id,
        message: 'Stamp issued successfully',
      };
      
    } catch (error) {
      console.error(`❌ Error processing order ${order.externalOrderId}:`, error);
      return this.failOrder(order, (error as Error).message);
    }
  }
  
  // ============================================
  // STAMP CRITERIA CHECK
  // ============================================
  
  /**
   * Check if order meets criteria for stamp issuance
   */
  private meetsStampCriteria(context: ProcessingContext): boolean {
    const { order, connection } = context;
    const settings = connection.settings;
    
    // Check if auto-stamp is enabled
    if (!settings.autoStampEnabled) {
      return false;
    }
    
    // Check order status matches trigger
    const statusMatches = this.checkStatusTrigger(order.orderStatus, settings.orderStatusTrigger);
    if (!statusMatches) {
      return false;
    }
    
    // Check minimum order value
    if (settings.minimumOrderValue && order.orderTotal < settings.minimumOrderValue) {
      return false;
    }
    
    // Check qualifying products (if specific SKUs required)
    if (settings.qualifyingProducts === 'specific' && settings.qualifyingSkus?.length) {
      const hasQualifyingItem = order.items.some(
        item => item.sku && settings.qualifyingSkus!.includes(item.sku)
      );
      if (!hasQualifyingItem) {
        return false;
      }
    }
    
    // Must have customer email
    if (!order.customerEmail) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if order status matches the configured trigger
   */
  private checkStatusTrigger(
    orderStatus: EcommerceOrder['orderStatus'],
    trigger: EcommerceConnection['settings']['orderStatusTrigger']
  ): boolean {
    switch (trigger) {
      case 'order_placed':
        return true; // Always trigger
      case 'payment_complete':
        return ['paid', 'processing', 'shipped', 'delivered', 'completed'].includes(orderStatus);
      case 'order_shipped':
        return ['shipped', 'delivered', 'completed'].includes(orderStatus);
      case 'order_delivered':
        return ['delivered', 'completed'].includes(orderStatus);
      default:
        return orderStatus === 'paid';
    }
  }
  
  // ============================================
  // MEMBER MATCHING
  // ============================================
  
  /**
   * Find member by email or check if already invited
   */
  private async findOrInviteMember(
    email: string, 
    context: ProcessingContext
  ): Promise<MemberLookupResult> {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check primary email lookup
    const memberId = await redisClient.get(ECOMMERCE_REDIS_KEYS.memberByEmail(normalizedEmail));
    
    if (memberId) {
      const member = await redis.getMember(memberId);
      if (member) {
        return { status: 'found', member };
      }
    }
    
    // Check linked emails
    // TODO: Implement linked email lookup
    
    // Check if already invited
    const invitedKey = `ecommerce:invited:${normalizedEmail}`;
    const alreadyInvited = await redisClient.exists(invitedKey);
    
    if (alreadyInvited) {
      return { status: 'invited' };
    }
    
    return { status: 'not_found' };
  }
  
  /**
   * Send join invitation email to customer
   */
  private async sendJoinInvitation(email: string, business: Business): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Mark as invited (expires in 30 days)
    await redisClient.setex(
      `ecommerce:invited:${normalizedEmail}`,
      30 * 24 * 60 * 60,
      JSON.stringify({
        businessId: business.id,
        businessName: business.name,
        invitedAt: new Date().toISOString(),
      })
    );
    
    // TODO: Actually send invitation email
    console.log(`📧 Would send invitation email to ${email} from ${business.name}`);
  }
  
  // ============================================
  // STAMP ISSUANCE
  // ============================================
  
  /**
   * Issue an online stamp to a member
   */
  private async issueOnlineStamp(
    member: Member,
    context: ProcessingContext
  ): Promise<Stamp> {
    const { order, business } = context;
    
    const stampId = uuidv4();
    const now = new Date().toISOString();
    
    const stamp: Stamp = {
      id: stampId,
      customerId: member.id,  // Map member.id to customerId
      memberId: member.id,     // Keep memberId for backward compatibility
      businessId: business.id,
      rewardId: '', // Will be determined by reward rules
      issuedAt: now,
      issuedBy: 'system',
      method: 'manual', // 'online' when we add channel support
      metadata: {
        channel: 'online',
        ecommerceOrderId: order.externalOrderId,
        ecommercePlatform: order.platform,
        orderValue: order.orderTotal,
        orderCurrency: order.currency,
        orderReference: order.externalOrderNumber,
      },
    };
    
    // Store stamp
    await redisClient.set(REDIS_KEYS.stamp(stampId), JSON.stringify(stamp));
    
    // Add to member's stamp list
    const stampKey = REDIS_KEYS.memberStamps(member.id, business.id);
    await redisClient.rpush(stampKey, JSON.stringify(stamp));
    
    // Update member stats
    const updatedMember = {
      ...member,
      totalStamps: (member.totalStamps || 0) + 1,
      updatedAt: now,
    };
    await redis.setMember(member.id, updatedMember);
    
    // Update business stats
    const updatedBusiness = {
      ...business,
      stats: {
        ...business.stats,
        totalStampsIssued: (business.stats.totalStampsIssued || 0) + 1,
      },
      updatedAt: now,
    };
    await redis.setBusiness(business.id, updatedBusiness);
    
    // Update daily analytics
    const today = new Date().toISOString().split('T')[0];
    await redis.incrementStat(REDIS_KEYS.dailyStats(today), 'stamps', 1);
    await redis.incrementStat(REDIS_KEYS.dailyStats(today), 'online_stamps', 1);
    await redis.incrementStat(
      ECOMMERCE_REDIS_KEYS.dailyPlatformStats(business.id, today, order.platform),
      'stamps',
      1
    );
    
    // Check reward threshold
    const stampCount = await redisClient.llen(stampKey);
    // TODO: Trigger reward check
    
    return stamp;
  }
  
  // ============================================
  // NOTIFICATIONS
  // ============================================
  
  /**
   * Notify member about their online stamp
   */
  private async notifyMember(
    member: Member,
    business: Business,
    stamp: Stamp,
    order: EcommerceOrder
  ): Promise<void> {
    // TODO: Integrate with notification service
    console.log(`🔔 Would notify member ${member.id} about stamp from ${business.name}`);
    
    // Create notification record
    const notification = {
      id: uuidv4(),
      type: 'stamp_earned',
      memberId: member.id,
      businessId: business.id,
      title: '🥕 Stamp earned!',
      message: `You earned a stamp from ${business.name} for your online order!`,
      data: {
        stampId: stamp.id,
        orderId: order.externalOrderId,
        channel: 'online',
      },
      createdAt: new Date().toISOString(),
      read: false,
    };
    
    await redisClient.lpush(
      `member:${member.id}:notifications`,
      JSON.stringify(notification)
    );
  }
  
  // ============================================
  // ORDER RECORD MANAGEMENT
  // ============================================
  
  /**
   * Store order in Redis
   */
  async storeOrder(order: EcommerceOrder): Promise<void> {
    await redisClient.set(
      ECOMMERCE_REDIS_KEYS.order(order.id),
      JSON.stringify(order)
    );
    
    // Add external ID lookup
    await redisClient.set(
      ECOMMERCE_REDIS_KEYS.orderByExternal(order.platform, order.externalOrderId),
      order.id
    );
    
    // Add to business orders
    await redisClient.lpush(
      ECOMMERCE_REDIS_KEYS.businessOrders(order.businessId),
      order.id
    );
    
    // Add to pending queue
    await redisClient.lpush(ECOMMERCE_REDIS_KEYS.orderQueue(), order.id);
  }
  
  /**
   * Get order by external ID
   */
  private async getOrderByExternalId(
    platform: string, 
    externalId: string
  ): Promise<EcommerceOrder | null> {
    const orderId = await redisClient.get(
      ECOMMERCE_REDIS_KEYS.orderByExternal(platform, externalId)
    );
    if (!orderId) return null;
    
    const data = await redisClient.get(ECOMMERCE_REDIS_KEYS.order(orderId));
    return data ? JSON.parse(data) : null;
  }
  
  /**
   * Mark order as completed
   */
  private async markOrderCompleted(
    order: EcommerceOrder, 
    memberId: string, 
    stampId: string
  ): Promise<void> {
    order.processingStatus = 'completed';
    order.memberId = memberId;
    order.stampId = stampId;
    order.processedAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    
    await redisClient.set(
      ECOMMERCE_REDIS_KEYS.order(order.id),
      JSON.stringify(order)
    );
    
    // Remove from pending queue
    await redisClient.lrem(ECOMMERCE_REDIS_KEYS.orderQueue(), 0, order.id);
  }
  
  // ============================================
  // HELPER METHODS
  // ============================================
  
  private async getConnection(connectionId: string): Promise<EcommerceConnection | null> {
    const data = await redisClient.get(ECOMMERCE_REDIS_KEYS.connection(connectionId));
    return data ? JSON.parse(data) : null;
  }
  
  private async updateSyncStats(connectionId: string, stampIssued: boolean): Promise<void> {
    const connection = await this.getConnection(connectionId);
    if (!connection) return;
    
    connection.syncStatus.lastSyncAt = new Date().toISOString();
    connection.syncStatus.lastSyncStatus = 'success';
    connection.syncStatus.totalOrdersSynced++;
    if (stampIssued) {
      connection.syncStatus.totalStampsIssued++;
    }
    connection.updatedAt = new Date().toISOString();
    
    await redisClient.set(
      ECOMMERCE_REDIS_KEYS.connection(connectionId),
      JSON.stringify(connection)
    );
  }
  
  private failOrder(order: EcommerceOrder, reason: string): OrderProcessingResult {
    order.processingStatus = 'failed';
    order.processingError = reason;
    // Store the failed order
    redisClient.set(ECOMMERCE_REDIS_KEYS.order(order.id), JSON.stringify(order));
    
    return {
      orderId: order.id,
      status: 'failed',
      message: reason,
    };
  }
  
  private skipOrder(order: EcommerceOrder, reason: string): OrderProcessingResult {
    order.processingStatus = 'skipped';
    order.processingError = reason;
    redisClient.set(ECOMMERCE_REDIS_KEYS.order(order.id), JSON.stringify(order));
    
    return {
      orderId: order.id,
      status: 'skipped',
      message: reason,
    };
  }
  
  private inviteOrder(order: EcommerceOrder, message: string): OrderProcessingResult {
    order.processingStatus = 'invited';
    redisClient.set(ECOMMERCE_REDIS_KEYS.order(order.id), JSON.stringify(order));
    
    // Add to unmatched orders for business
    redisClient.lpush(ECOMMERCE_REDIS_KEYS.unmatchedOrders(order.businessId), order.id);
    
    return {
      orderId: order.id,
      status: 'invited',
      message,
      invitationSent: true,
    };
  }
}

export const orderProcessor = new OrderProcessorService();

