import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, MoreThan } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationEntity } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly gateway: NotificationsGateway,
    private readonly httpService: HttpService,
    @InjectRepository(NotificationEntity) private readonly repo: Repository<NotificationEntity>,
  ) {}

  // Very simple in-memory store just to satisfy frontend endpoints
  private notifications: Array<{
    id: number;
    type: string;
    title: string;
    description: string;
    user_id?: number;
    status: 'unread' | 'read' | 'archived';
    entity_id?: number;
    entity_type?: string;
    target_url?: string;
    metadata?: any;
    expires_at?: string;
    priority: 'low' | 'medium' | 'high';
    created_at: string;
    updated_at: string;
  }> = [];
  private nextId = 1;

  async getUnreadCount(userId?: number) {
    if (userId) {
      const count = await this.repo.count({ 
        where: { 
          status: 'unread',
          user_id: userId 
        } as any 
      });
      return { count };
    }
    const count = await this.repo.count({ where: { status: 'unread' } as any });
    return { count };
  }

  async onExpiringLabel(event: { labelId: number; labelCode: string; preparationId: number; expiresAt: string }) {
    // For expiring labels, apply time-based deduplication (5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await this.repo.findOne({ 
      where: { 
        entity_id: event.labelId, 
        entity_type: 'recipe_label', 
        type: 'label_expiring',
        created_at: MoreThanOrEqual(fiveMinutesAgo) as any
      } as any 
    });
    
    if (existing) {
      return existing;
    }
    
    // Create a persistent notification for expiring label
    const saved = await this.create({
      type: 'label_expiring',
      title: 'Eticheta aproape de expirare',
      description: `Eticheta ${event.labelCode} va expira la ${new Date(event.expiresAt).toLocaleString('ro-RO')}`,
      entity_id: event.labelId,
      entity_type: 'recipe_label',
      target_url: '/retetar/istoric-etichete',
      metadata: { preparationId: event.preparationId, labelCode: event.labelCode, expiresAt: event.expiresAt },
      priority: 'high',
      status: 'unread',
      expires_at: event.expiresAt as any,
    } as any);
    return saved;
  }

  async onRecipeNotification(event: { 
    type: string;
    title: string;
    description: string;
    entity_id: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string; // Add target_url parameter
  }) {
    // For update-type notifications, apply time-based deduplication (5 minutes)
    let existing: NotificationEntity | null = null;
    if (event.type.includes('updated') || event.type.includes('modified')) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      existing = await this.repo.findOne({ 
        where: { 
          entity_id: event.entity_id, 
          entity_type: event.entity_type, 
          type: event.type,
          created_at: MoreThanOrEqual(fiveMinutesAgo) as any
        } as any 
      });
    } else {
      // For non-update notifications, check for any existing duplicate
      existing = await this.repo.findOne({ 
        where: { 
          entity_id: event.entity_id, 
          entity_type: event.entity_type, 
          type: event.type 
        } as any 
      });
    }
    
    if (existing) {
      return existing;
    }
    
    // Get users with manager and admin roles
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    
    // Create notifications for each manager and admin user
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      const saved = await this.create({
        type: event.type,
        title: event.title,
        description: event.description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url, // Pass through target_url
      } as any);
      notifications.push(saved);
    }
    
    return notifications;
  }

  async onStockNotification(event: { 
    type: string;
    title: string;
    description: string;
    entity_id: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string; // Add target_url parameter
  }) {
    // For update-type notifications, apply time-based deduplication (5 minutes)
    let existing: NotificationEntity | null = null;
    if (event.type.includes('updated') || event.type.includes('modified')) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      existing = await this.repo.findOne({ 
        where: { 
          entity_id: event.entity_id, 
          entity_type: event.entity_type, 
          type: event.type,
          created_at: MoreThanOrEqual(fiveMinutesAgo) as any
        } as any 
      });
    } else {
      // For non-update notifications, check for any existing duplicate
      existing = await this.repo.findOne({ 
        where: { 
          entity_id: event.entity_id, 
          entity_type: event.entity_type, 
          type: event.type 
        } as any 
      });
    }
    
    if (existing) {
      return existing;
    }
    
    // Get users with manager and admin roles
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    
    // Create notifications for each manager and admin user
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      const saved = await this.create({
        type: event.type,
        title: event.title,
        description: event.description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url, // Pass through target_url
      } as any);
      notifications.push(saved);
    }
    
    return notifications;
  }

  async onLocationNotification(event: { 
    type: string;
    title: string;
    description: string;
    entity_id: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string; // Add target_url parameter
  }) {
    console.log(`🔍 [NOTIFICATIONS SERVICE] Received location notification - Type: ${event.type}, Location ID: ${event.entity_id}`);
    
    // For update-type notifications, apply time-based deduplication (5 minutes)
    let existing: NotificationEntity | null = null;
    if (event.type.includes('updated') || event.type.includes('modified')) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      existing = await this.repo.findOne({ 
        where: { 
          entity_id: event.entity_id, 
          entity_type: event.entity_type, 
          type: event.type,
          created_at: MoreThanOrEqual(fiveMinutesAgo) as any
        } as any 
      });
    } else {
      // For non-update notifications, check for any existing duplicate
      existing = await this.repo.findOne({ 
        where: { 
          entity_id: event.entity_id, 
          entity_type: event.entity_type, 
          type: event.type 
        } as any 
      });
    }
    
    if (existing) {
      console.log(`⚠️ [NOTIFICATIONS SERVICE] Duplicate notification ignored - Type: ${event.type}, Location ID: ${event.entity_id}`);
      return existing;
    }
    
    // Get users with manager and admin roles
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    console.log(`👥 [NOTIFICATIONS SERVICE] Found ${managerAndAdminUsers.length} users with manager/admin roles`);
    
    // Create notifications for each manager and admin user
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      const saved = await this.create({
        type: event.type,
        title: event.title,
        description: event.description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url, // Pass through target_url
      } as any);
      notifications.push(saved);
    }
    
    console.log(`✅ [NOTIFICATIONS SERVICE] Created ${notifications.length} notifications for location event`);
    return notifications;
  }

  async onSupplierNotification(event: { 
    type: string;
    title: string;
    description: string;
    entity_id: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string; // Add target_url parameter
  }) {
    console.log(`📥 [NOTIFICATIONS SERVICE] Received supplier notification:`, JSON.stringify(event, null, 2));
    
    // Always create notifications for supplier events - remove duplicate detection for now
    // This ensures that all supplier operations generate notifications
    
    // Get users with manager and admin roles
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    console.log(`👥 [NOTIFICATIONS SERVICE] Found ${managerAndAdminUsers.length} users with manager/admin roles for supplier notification`);
    
    // Create notifications for each manager and admin user
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      console.log(`📝 [NOTIFICATIONS SERVICE] Creating notification for user ID: ${user.id}`);
      
      const saved = await this.create({
        type: event.type,
        title: event.title,
        description: event.description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url, // Pass through target_url
      } as any);
      notifications.push(saved);
    }
    
    console.log(`✅ [NOTIFICATIONS SERVICE] Created ${notifications.length} notifications for supplier event`);
    return notifications;
  }

  async onLeaveNotification(event: { 
    type: string;
    title: string;
    description: string;
    user_id: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string; // Add target_url parameter
  }) {
    console.log(`📥 [NOTIFICATIONS SERVICE] Received leave notification event:`, JSON.stringify(event, null, 2));
    
    // Avoid duplicate notifications for the same entity if one already exists
    // Use the requestId from metadata if available, otherwise fall back to user_id
    const entityId = event.metadata?.requestId || event.user_id;
    const existing = await this.repo.findOne({ 
      where: { 
        entity_id: entityId, 
        entity_type: event.entity_type, 
        type: event.type 
      } as any 
    });
    
    if (existing) {
      console.log(`⚠️ [NOTIFICATIONS SERVICE] Duplicate leave notification ignored - Type: ${event.type}, Entity ID: ${entityId}`);
      return existing;
    }
    
    // Get users with manager and admin roles for admin/manager notifications
    // For employee notifications, send directly to the employee
    let targetUsers = [];
    
    if (event.type === 'leave_request_created') {
      console.log(`👥 [NOTIFICATIONS SERVICE] Leave request created - sending to managers and admins`);
      // Send to managers and admins
      targetUsers = await this.getUsersWithRoles(['manager', 'admin']);
    } else {
      console.log(`👤 [NOTIFICATIONS SERVICE] Leave request ${event.type} - sending to employee ${event.user_id}`);
      // Send to the specific employee
      targetUsers = [{ id: event.user_id }];
    }
    
    console.log(`🎯 [NOTIFICATIONS SERVICE] Target users for notification:`, JSON.stringify(targetUsers, null, 2));
    
    // Create notifications for target users
    const notifications = [];
    for (const user of targetUsers) {
      console.log(`📝 [NOTIFICATIONS SERVICE] Creating notification for user ID: ${user.id}`);
      
      const saved = await this.create({
        type: event.type,
        title: event.title,
        description: event.description,
        user_id: user.id,
        entity_id: entityId,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url, // Pass through target_url
      } as any);
      notifications.push(saved);
    }
    
    console.log(`✅ [NOTIFICATIONS SERVICE] Created ${notifications.length} notifications for leave event`);
    return notifications;
  }

  async onShiftChangeNotification(event: { 
    type: string;
    title: string;
    description: string;
    user_id: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string; // Add target_url parameter
  }) {
    console.log(`📥 [NOTIFICATIONS SERVICE] Received shift change notification event:`, JSON.stringify(event, null, 2));
    
    // Avoid duplicate notifications for the same entity if one already exists
    // Use the requestId from metadata if available, otherwise fall back to user_id
    const entityId = event.metadata?.requestId || event.user_id;
    const existing = await this.repo.findOne({ 
      where: { 
        entity_id: entityId, 
        entity_type: event.entity_type, 
        type: event.type 
      } as any 
    });
    
    if (existing) {
      console.log(`⚠️ [NOTIFICATIONS SERVICE] Duplicate shift change notification ignored - Type: ${event.type}, Entity ID: ${entityId}`);
      return existing;
    }
    
    // Get users with manager and admin roles for admin/manager notifications
    // For employee notifications, send directly to the employee
    let targetUsers = [];
    
    if (event.type === 'shift_change_request_created') {
      console.log(`👥 [NOTIFICATIONS SERVICE] Shift change request created - sending to managers and admins`);
      // Send to managers and admins
      targetUsers = await this.getUsersWithRoles(['manager', 'admin']);
    } else {
      console.log(`👤 [NOTIFICATIONS SERVICE] Shift change request ${event.type} - sending to employee ${event.user_id}`);
      // Send to the specific employee
      targetUsers = [{ id: event.user_id }];
    }
    
    console.log(`🎯 [NOTIFICATIONS SERVICE] Target users for notification:`, JSON.stringify(targetUsers, null, 2));
    
    // Create notifications for target users
    const notifications = [];
    for (const user of targetUsers) {
      console.log(`📝 [NOTIFICATIONS SERVICE] Creating notification for user ID: ${user.id}`);
      
      const saved = await this.create({
        type: event.type,
        title: event.title,
        description: event.description,
        user_id: user.id,
        entity_id: entityId,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url, // Pass through target_url
      } as any);
      notifications.push(saved);
    }
    
    console.log(`✅ [NOTIFICATIONS SERVICE] Created ${notifications.length} notifications for shift change event`);
    return notifications;
  }

  async onAttendanceNotification(event: { 
    type: string;
    title: string;
    description: string;
    user_id: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
  }) {
    console.log(`📥 [NOTIFICATIONS SERVICE] Received attendance notification event:`, JSON.stringify(event, null, 2));
    
    // Avoid duplicate notifications for the same entity if one already exists
    // Use the attendanceId from metadata if available, otherwise fall back to user_id
    const entityId = event.metadata?.attendanceId || event.user_id;
    const existing = await this.repo.findOne({ 
      where: { 
        entity_id: entityId, 
        entity_type: event.entity_type, 
        type: event.type 
      } as any 
    });
    
    if (existing) {
      console.log(`⚠️ [NOTIFICATIONS SERVICE] Duplicate attendance notification ignored - Type: ${event.type}, Entity ID: ${entityId}`);
      return existing;
    }
    
    // Get users with manager and admin roles for admin notifications
    // Also include the employee for whom the attendance was created
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    const employeeUser = [{ id: event.user_id }];
    
    // Combine both groups (avoiding duplicates)
    const allTargetUsers = [...managerAndAdminUsers, ...employeeUser];
    const uniqueTargetUsers = allTargetUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.id === user.id)
    );
    
    console.log(`🎯 [NOTIFICATIONS SERVICE] Target users for notification:`, JSON.stringify(uniqueTargetUsers, null, 2));
    
    // Create notifications for target users
    const notifications = [];
    for (const user of uniqueTargetUsers) {
      console.log(`📝 [NOTIFICATIONS SERVICE] Creating notification for user ID: ${user.id}`);
      
      const saved = await this.create({
        type: event.type,
        title: event.title,
        description: event.description,
        user_id: user.id,
        entity_id: entityId,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
      } as any);
      notifications.push(saved);
    }
    
    console.log(`✅ [NOTIFICATIONS SERVICE] Created ${notifications.length} notifications for attendance event`);
    return notifications;
  }

  async onShiftNotification(event: { 
    type: string;
    title: string;
    description: string;
    user_id: number;
    entity_id: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string; // Add target_url parameter
  }) {
    console.log(`📥 [NOTIFICATIONS SERVICE] Received shift notification event:`, JSON.stringify(event, null, 2));
    
    // Avoid duplicate notifications for the same entity if one already exists
    const existing = await this.repo.findOne({ 
      where: { 
        entity_id: event.entity_id, 
        entity_type: event.entity_type, 
        type: event.type 
      } as any 
    });
    
    if (existing) {
      console.log(`⚠️ [NOTIFICATIONS SERVICE] Duplicate shift notification ignored - Type: ${event.type}, Entity ID: ${event.entity_id}`);
      return existing;
    }
    
    // Get users with manager and admin roles for admin notifications
    // Also include the employee for whom the shift was created
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    const employeeUser = [{ id: event.user_id }];
    
    // Combine both groups (avoiding duplicates)
    const allTargetUsers = [...managerAndAdminUsers, ...employeeUser];
    const uniqueTargetUsers = allTargetUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.id === user.id)
    );
    
    console.log(`🎯 [NOTIFICATIONS SERVICE] Target users for notification:`, JSON.stringify(uniqueTargetUsers, null, 2));
    
    // Create notifications for target users
    const notifications = [];
    for (const user of uniqueTargetUsers) {
      console.log(`📝 [NOTIFICATIONS SERVICE] Creating notification for user ID: ${user.id}`);
      
      const saved = await this.create({
        type: event.type,
        title: event.title,
        description: event.description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url, // Pass through target_url
      } as any);
      notifications.push(saved);
    }
    
    console.log(`✅ [NOTIFICATIONS SERVICE] Created ${notifications.length} notifications for shift event`);
    return notifications;
  }

  private async getUsersWithRoles(roleNames: string[]): Promise<Array<{id: number, email: string, roles: string[]}>> {
    try {
      console.log(`🔍 [NOTIFICATIONS SERVICE] Fetching users with roles: ${roleNames.join(', ')}`);
      
      const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';
      console.log(`📡 [NOTIFICATIONS SERVICE] Using API Gateway URL: ${apiGatewayUrl}`);
      
      // First get all roles
      console.log(`📥 [NOTIFICATIONS SERVICE] Fetching all roles from ${apiGatewayUrl}/users/roles`);
      const rolesResponse = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/users/roles`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      console.log(`✅ [NOTIFICATIONS SERVICE] Roles response received`);
      
      // Filter roles by names - the response is wrapped in a data object
      const rolesData = Array.isArray(rolesResponse.data) ? rolesResponse.data : rolesResponse.data.data || [];
      console.log(`📋 [NOTIFICATIONS SERVICE] All roles data:`, JSON.stringify(rolesData, null, 2));
      
      const targetRoles = rolesData.filter((role: any) => 
        roleNames.includes(role.name)
      );
      console.log(`🎯 [NOTIFICATIONS SERVICE] Target roles found:`, JSON.stringify(targetRoles, null, 2));
      
      if (targetRoles.length === 0) {
        console.log(`⚠️ [NOTIFICATIONS SERVICE] No target roles found`);
        return [];
      }
      
      // Get all user roles
      console.log(`📥 [NOTIFICATIONS SERVICE] Fetching user roles from ${apiGatewayUrl}/users/user-roles`);
      const userRolesResponse = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/users/user-roles`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      console.log(`✅ [NOTIFICATIONS SERVICE] User roles response received`);
      
      // User roles data is also wrapped in a data object
      const userRolesData = Array.isArray(userRolesResponse.data) ? userRolesResponse.data : userRolesResponse.data.data || [];
      console.log(`📋 [NOTIFICATIONS SERVICE] User roles data length: ${userRolesData.length}`);
      
      // Find user IDs that have the target roles
      const targetRoleIds = targetRoles.map((role: any) => role.id);
      console.log(`🎯 [NOTIFICATIONS SERVICE] Target role IDs:`, targetRoleIds);
      
      const targetUserIds = userRolesData
        .filter((userRole: any) => targetRoleIds.includes(userRole.roleId))
        .map((userRole: any) => userRole.userId);
      console.log(`👥 [NOTIFICATIONS SERVICE] Target user IDs:`, targetUserIds);
      
      // Get unique user IDs
      const uniqueUserIds = [...new Set(targetUserIds)];
      console.log(`🔢 [NOTIFICATIONS SERVICE] Unique user IDs:`, uniqueUserIds);
      
      if (uniqueUserIds.length === 0) {
        console.log(`⚠️ [NOTIFICATIONS SERVICE] No users found with target roles`);
        return [];
      }
      
      // Get user details for these users
      const users = [];
      for (const userId of uniqueUserIds) {
        try {
          console.log(`📥 [NOTIFICATIONS SERVICE] Fetching user details for user ID: ${userId}`);
          const userResponse = await firstValueFrom(
            this.httpService.get(`${apiGatewayUrl}/users/${userId}`, {
              headers: {
                'x-internal-service': 'notifications',
                'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
              }
            })
          );
          console.log(`✅ [NOTIFICATIONS SERVICE] User response received for user ID: ${userId}`);
          
          // User data is also wrapped in a data object
          const userData = userResponse.data.data || userResponse.data;
          console.log(`👤 [NOTIFICATIONS SERVICE] User data for user ID ${userId}:`, JSON.stringify(userData, null, 2));
          
          // Get user roles
          const userRoles = userRolesData
            .filter((userRole: any) => userRole.userId === userId)
            .map((userRole: any) => {
              const role = targetRoles.find((r: any) => r.id === userRole.roleId);
              return role ? role.name : null;
            })
            .filter(Boolean);
          
          console.log(`🏷️ [NOTIFICATIONS SERVICE] Roles for user ID ${userId}:`, userRoles);
          
          users.push({
            id: userData.id,
            email: userData.email,
            roles: userRoles
          });
        } catch (error) {
          // Skip users that can't be fetched
          console.warn(`⚠️ [NOTIFICATIONS SERVICE] Could not fetch user with ID ${userId}:`, error);
        }
      }
      
      console.log(`✅ [NOTIFICATIONS SERVICE] Found ${users.length} users with target roles`);
      return users;
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SERVICE] Error fetching users with roles:', error);
      // Return empty array if there's an error
      return [];
    }
  }

  async onEmployeeNotification(event: { 
    type: string;
    title: string;
    description: string;
    entity_id?: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string; // Add target_url parameter
  }) {
    // Avoid duplicate notifications for the same entity if one already exists
    if (event.entity_id) {
      const existing = await this.repo.findOne({ 
        where: { 
          entity_id: event.entity_id, 
          entity_type: event.entity_type, 
          type: event.type 
        } as any 
      });
      
      if (existing) {
        return existing;
      }
    }
    
    // Get users with manager and admin roles
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    
    // Create notifications for each manager and admin user
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      const saved = await this.create({
        type: event.type,
        title: event.title,
        description: event.description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url, // Pass through target_url
      } as any);
      notifications.push(saved);
    }
    
    return notifications;
  }

  // --- Minimal HTTP helpers to satisfy frontend ---
  async findAll(userId?: number) {
    if (userId) {
      return this.repo.find({ 
        where: { user_id: userId } as any,
        order: { created_at: 'DESC' } as any 
      });
    }
    return this.repo.find({ order: { created_at: 'DESC' } as any });
  }

  async create(notification: Partial<NotificationEntity>) {
    console.log('📥 [NOTIFICATIONS SERVICE] Creating notification with data:', JSON.stringify(notification, null, 2));
    
    const entity = this.repo.create({
      type: notification.type || 'general',
      title: notification.title || 'Notificare',
      description: notification.description || null,
      user_id: notification.user_id ?? null,
      status: (notification.status as any) || 'unread',
      entity_id: notification.entity_id ?? null,
      entity_type: notification.entity_type ?? null,
      target_url: notification.target_url ?? null,
      metadata: notification.metadata ?? null,
      expires_at: (notification.expires_at as any) ?? null,
      priority: (notification.priority as any) || 'low',
    } as any);
    
    console.log('📝 [NOTIFICATIONS SERVICE] Entity to be saved:', JSON.stringify(entity, null, 2));
    
    const saved = await this.repo.save(entity);
    console.log('✅ [NOTIFICATIONS SERVICE] Notification saved with ID:', (saved as any).id);
    
    const count = await this.repo.count({ where: { status: 'unread' } as any });
    console.log('🔄 [NOTIFICATIONS SERVICE] Emitting unread count:', count);
    this.gateway.emitUnreadCount(count);
    
    return saved;
  }

  async markAsRead(id: number) {
    await this.repo.update({ id } as any, { status: 'read' } as any);
    const count = await this.repo.count({ where: { status: 'unread' } as any });
    this.gateway.emitUnreadCount(count);
    return { id };
  }

  async markAllAsRead(userId?: number) {
    if (userId) {
      await this.repo.createQueryBuilder()
        .update(NotificationEntity)
        .set({ status: 'read' } as any)
        .where("status = 'unread' AND user_id = :userId", { userId })
        .execute();
      const count = await this.repo.count({ 
        where: { 
          status: 'unread',
          user_id: userId 
        } as any 
      });
      this.gateway.emitUnreadCount(count);
      return { message: 'All notifications marked as read' };
    }
    await this.repo.createQueryBuilder().update(NotificationEntity).set({ status: 'read' } as any).where("status = 'unread'").execute();
    const count = await this.repo.count({ where: { status: 'unread' } as any });
    this.gateway.emitUnreadCount(count);
    return { message: 'All notifications marked as read' };
  }

  seedExpiringLabel() {
    return this.create({
      type: 'label_expiring',
      title: 'Label va expira',
      description: 'Label-ul este aproape de expirare',
      priority: 'high',
      target_url: '/retetar/istoric-etichete',
    } as any);
  }

  // Cron job to check for expiring and expired files at 12:00 AM daily
  @Cron('0 0 0 * * *') // Runs at 12:00 AM every day
  async checkExpiringFiles() {
    console.log('🔍 [NOTIFICATIONS SERVICE] Starting daily file expiration check');
    
    try {
      // Get users with manager and admin roles
      const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
      
      if (managerAndAdminUsers.length === 0) {
        console.log('⚠️ [NOTIFICATIONS SERVICE] No manager or admin users found');
        return;
      }
      
      // Check for files expiring in 7 days
      await this.checkFilesExpiringInDays(7, managerAndAdminUsers);
      
      // Check for already expired files
      await this.checkExpiredFiles(managerAndAdminUsers);
      
      console.log('✅ [NOTIFICATIONS SERVICE] Completed daily file expiration check');
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SERVICE] Error in file expiration check:', error);
    }
  }
  
  // Check for files expiring in a specific number of days
  private async checkFilesExpiringInDays(days: number, users: Array<{id: number, email: string, roles: string[]}>) {
    console.log(`🔍 [NOTIFICATIONS SERVICE] Checking for files expiring in ${days} days`);
    
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    
    // Format date as YYYY-MM-DD for comparison
    const targetDateString = targetDate.toISOString().split('T')[0];
    
    try {
      const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';
      
      // Check company documents
      await this.checkCompanyDocumentsExpiring(targetDateString, days, users, apiGatewayUrl);
      
      // Check location files
      await this.checkLocationFilesExpiring(targetDateString, days, users, apiGatewayUrl);
      
      // Check employee files
      await this.checkEmployeeFilesExpiring(targetDateString, days, users, apiGatewayUrl);
      
      // Check supplier documents
      await this.checkSupplierDocumentsExpiring(targetDateString, days, users, apiGatewayUrl);
      
      console.log(`✅ [NOTIFICATIONS SERVICE] Completed check for files expiring in ${days} days`);
    } catch (error) {
      console.error(`❌ [NOTIFICATIONS SERVICE] Error checking files expiring in ${days} days:`, error);
    }
  }
  
  // Check for already expired files
  private async checkExpiredFiles(users: Array<{id: number, email: string, roles: string[]}>) {
    console.log('🔍 [NOTIFICATIONS SERVICE] Checking for already expired files');
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';
      
      // Check expired company documents
      await this.checkCompanyDocumentsExpired(today, users, apiGatewayUrl);
      
      // Check expired location files
      await this.checkLocationFilesExpired(today, users, apiGatewayUrl);
      
      // Check expired employee files
      await this.checkEmployeeFilesExpired(today, users, apiGatewayUrl);
      
      // Check expired supplier documents
      await this.checkSupplierDocumentsExpired(today, users, apiGatewayUrl);
      
      console.log('✅ [NOTIFICATIONS SERVICE] Completed check for expired files');
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SERVICE] Error checking expired files:', error);
    }
  }
  
  // Check company documents expiring
  private async checkCompanyDocumentsExpiring(targetDate: string, days: number, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      console.log(`🔍 [NOTIFICATIONS SERVICE] Checking company documents expiring on ${targetDate}`);
      
      // Make HTTP request to company service to get documents expiring on target date
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/companies/documents/expiring/${targetDate}`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      
      const documents = response.data;
      console.log(`📥 [NOTIFICATIONS SERVICE] Found ${documents.length} company documents expiring on ${targetDate}`);
      
      // Create notifications for each expiring document
      for (const document of documents) {
        const companyName = document.company?.company_name || 'N/A';
        
        // Create notification for each manager/admin user
        for (const user of users) {
          await this.create({
            type: 'company_document_expiring',
            title: `Document companie expira in ${days} zile`,
            description: `Documentul "${document.document_name}" al companiei "${companyName}" va expira in ${days} zile`,
            user_id: user.id,
            entity_id: document.id,
            entity_type: 'company_document',
            metadata: { 
              companyId: document.company_id,
              companyName,
              documentName: document.document_name,
              expireDate: document.expire_date,
              daysUntilExpiry: days
            },
            priority: 'medium',
            status: 'unread',
            target_url: `/firme/${document.company_id}`,
          } as any);
        }
      }
      
      console.log(`✅ [NOTIFICATIONS SERVICE] Created notifications for ${documents.length} expiring company documents`);
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SERVICE] Error checking company documents expiring:', error);
    }
  }
  
  // Check location files expiring
  private async checkLocationFilesExpiring(targetDate: string, days: number, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      console.log(`🔍 [NOTIFICATIONS SERVICE] Checking location files expiring on ${targetDate}`);
      
      // Make HTTP request to locations service to get files expiring on target date
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/locations/files/expiring/${targetDate}`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      
      const files = response.data;
      console.log(`📥 [NOTIFICATIONS SERVICE] Found ${files.length} location files expiring on ${targetDate}`);
      
      // Create notifications for each expiring file
      for (const file of files) {
        const locationName = file.workLocation?.location_name || 'N/A';
        
        // Create notification for each manager/admin user
        for (const user of users) {
          await this.create({
            type: 'location_file_expiring',
            title: `Document locatie expira in ${days} zile`,
            description: `Documentul "${file.file_name}" al locatiei "${locationName}" va expira in ${days} zile`,
            user_id: user.id,
            entity_id: file.id,
            entity_type: 'location_file',
            metadata: { 
              locationId: file.work_location_id,
              locationName,
              fileName: file.file_name,
              expireDate: file.expire_date,
              daysUntilExpiry: days
            },
            priority: 'medium',
            status: 'unread',
            target_url: `/locatii/${file.work_location_id}`,
          } as any);
        }
      }
      
      console.log(`✅ [NOTIFICATIONS SERVICE] Created notifications for ${files.length} expiring location files`);
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SERVICE] Error checking location files expiring:', error);
    }
  }
  
  // Check employee files expiring
  private async checkEmployeeFilesExpiring(targetDate: string, days: number, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      console.log(`🔍 [NOTIFICATIONS SERVICE] Checking employee files expiring on ${targetDate}`);
      
      // Make HTTP request to employees service to get files expiring on target date
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/employees/files/expiring/${targetDate}`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      
      const files = response.data;
      console.log(`📥 [NOTIFICATIONS SERVICE] Found ${files.length} employee files expiring on ${targetDate}`);
      
      // Create notifications for each expiring file
      for (const file of files) {
        const employeeName = file.employee ? `${file.employee.first_name} ${file.employee.last_name}` : 'N/A';
        
        // Create notification for each manager/admin user
        for (const user of users) {
          await this.create({
            type: 'employee_file_expiring',
            title: `Document angajat expira in ${days} zile`,
            description: `Documentul "${file.file_name}" al angajatului "${employeeName}" va expira in ${days} zile`,
            user_id: user.id,
            entity_id: file.id,
            entity_type: 'employee_file',
            metadata: { 
              employeeId: file.employee_id,
              employeeName,
              fileName: file.file_name,
              expireDate: file.expire_date,
              daysUntilExpiry: days
            },
            priority: 'medium',
            status: 'unread',
            target_url: `/angajati/${file.employee_id}`,
          } as any);
        }
      }
      
      console.log(`✅ [NOTIFICATIONS SERVICE] Created notifications for ${files.length} expiring employee files`);
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SERVICE] Error checking employee files expiring:', error);
    }
  }
  
  // Check supplier documents expiring
  private async checkSupplierDocumentsExpiring(targetDate: string, days: number, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      console.log(`🔍 [NOTIFICATIONS SERVICE] Checking supplier documents expiring on ${targetDate}`);
      
      // Make HTTP request to suppliers service to get documents expiring on target date
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/suppliers/documents/expiring/${targetDate}`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      
      const documents = response.data;
      console.log(`📥 [NOTIFICATIONS SERVICE] Found ${documents.length} supplier documents expiring on ${targetDate}`);
      
      // Create notifications for each expiring document
      for (const document of documents) {
        const supplierName = document.folder?.supplier?.supplier_name || 'N/A';
        
        // Create notification for each manager/admin user
        for (const user of users) {
          await this.create({
            type: 'supplier_document_expiring',
            title: `Document furnizor expira in ${days} zile`,
            description: `Documentul "${document.file_name}" al furnizorului "${supplierName}" va expira in ${days} zile`,
            user_id: user.id,
            entity_id: document.id,
            entity_type: 'supplier_document',
            metadata: { 
              supplierId: document.folder?.supplier_id,
              supplierName,
              fileName: document.file_name,
              expireDate: document.expire_date,
              daysUntilExpiry: days
            },
            priority: 'medium',
            status: 'unread',
            target_url: `/furnizori/${document.folder?.supplier_id}`,
          } as any);
        }
      }
      
      console.log(`✅ [NOTIFICATIONS SERVICE] Created notifications for ${documents.length} expiring supplier documents`);
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SERVICE] Error checking supplier documents expiring:', error);
    }
  }
  
  // Check company documents expired
  private async checkCompanyDocumentsExpired(today: string, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      console.log(`🔍 [NOTIFICATIONS SERVICE] Checking company documents expired before ${today}`);
      
      // Make HTTP request to company service to get expired documents
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/companies/documents/expired`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      
      const documents = response.data;
      console.log(`📥 [NOTIFICATIONS SERVICE] Found ${documents.length} expired company documents`);
      
      // Create notifications for each expired document
      for (const document of documents) {
        const companyName = document.company?.company_name || 'N/A';
        
        // Create notification for each manager/admin user
        for (const user of users) {
          await this.create({
            type: 'company_document_expired',
            title: 'Document companie expirat',
            description: `Documentul "${document.document_name}" al companiei "${companyName}" a expirat`,
            user_id: user.id,
            entity_id: document.id,
            entity_type: 'company_document',
            metadata: { 
              companyId: document.company_id,
              companyName,
              documentName: document.document_name,
              expireDate: document.expire_date
            },
            priority: 'high',
            status: 'unread',
            target_url: `/firme/${document.company_id}`,
          } as any);
        }
      }
      
      console.log(`✅ [NOTIFICATIONS SERVICE] Created notifications for ${documents.length} expired company documents`);
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SERVICE] Error checking company documents expired:', error);
    }
  }
  
  // Check location files expired
  private async checkLocationFilesExpired(today: string, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      console.log(`🔍 [NOTIFICATIONS SERVICE] Checking location files expired before ${today}`);
      
      // Make HTTP request to locations service to get expired files
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/locations/files/expired`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      
      const files = response.data;
      console.log(`📥 [NOTIFICATIONS SERVICE] Found ${files.length} expired location files`);
      
      // Create notifications for each expired file
      for (const file of files) {
        const locationName = file.workLocation?.location_name || 'N/A';
        
        // Create notification for each manager/admin user
        for (const user of users) {
          await this.create({
            type: 'location_file_expired',
            title: 'Document locatie expirat',
            description: `Documentul "${file.file_name}" al locatiei "${locationName}" a expirat`,
            user_id: user.id,
            entity_id: file.id,
            entity_type: 'location_file',
            metadata: { 
              locationId: file.work_location_id,
              locationName,
              fileName: file.file_name,
              expireDate: file.expire_date
            },
            priority: 'high',
            status: 'unread',
            target_url: `/locatii/${file.work_location_id}`,
          } as any);
        }
      }
      
      console.log(`✅ [NOTIFICATIONS SERVICE] Created notifications for ${files.length} expired location files`);
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SERVICE] Error checking location files expired:', error);
    }
  }
  
  // Check employee files expired
  private async checkEmployeeFilesExpired(today: string, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      console.log(`🔍 [NOTIFICATIONS SERVICE] Checking employee files expired before ${today}`);
      
      // Make HTTP request to employees service to get expired files
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/employees/files/expired`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      
      const files = response.data;
      console.log(`📥 [NOTIFICATIONS SERVICE] Found ${files.length} expired employee files`);
      
      // Create notifications for each expired file
      for (const file of files) {
        const employeeName = file.employee ? `${file.employee.first_name} ${file.employee.last_name}` : 'N/A';
        
        // Create notification for each manager/admin user
        for (const user of users) {
          await this.create({
            type: 'employee_file_expired',
            title: 'Document angajat expirat',
            description: `Documentul "${file.file_name}" al angajatului "${employeeName}" a expirat`,
            user_id: user.id,
            entity_id: file.id,
            entity_type: 'employee_file',
            metadata: { 
              employeeId: file.employee_id,
              employeeName,
              fileName: file.file_name,
              expireDate: file.expire_date
            },
            priority: 'high',
            status: 'unread',
            target_url: `/angajati/${file.employee_id}`,
          } as any);
        }
      }
      
      console.log(`✅ [NOTIFICATIONS SERVICE] Created notifications for ${files.length} expired employee files`);
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SERVICE] Error checking employee files expired:', error);
    }
  }
  
  // Check supplier documents expired
  private async checkSupplierDocumentsExpired(today: string, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      console.log(`🔍 [NOTIFICATIONS SERVICE] Checking supplier documents expired before ${today}`);
      
      // Make HTTP request to suppliers service to get expired documents
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/suppliers/documents/expired`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      
      const documents = response.data;
      console.log(`📥 [NOTIFICATIONS SERVICE] Found ${documents.length} expired supplier documents`);
      
      // Create notifications for each expired document
      for (const document of documents) {
        const supplierName = document.folder?.supplier?.supplier_name || 'N/A';
        
        // Create notification for each manager/admin user
        for (const user of users) {
          await this.create({
            type: 'supplier_document_expired',
            title: 'Document furnizor expirat',
            description: `Documentul "${document.file_name}" al furnizorului "${supplierName}" a expirat`,
            user_id: user.id,
            entity_id: document.id,
            entity_type: 'supplier_document',
            metadata: { 
              supplierId: document.folder?.supplier_id,
              supplierName,
              fileName: document.file_name,
              expireDate: document.expire_date
            },
            priority: 'high',
            status: 'unread',
            target_url: `/furnizori/${document.folder?.supplier_id}`,
          } as any);
        }
      }
      
      console.log(`✅ [NOTIFICATIONS SERVICE] Created notifications for ${documents.length} expired supplier documents`);
    } catch (error) {
      console.error('❌ [NOTIFICATIONS SERVICE] Error checking supplier documents expired:', error);
    }
  }

  async onCalendarNotification(event: { 
    type: string;
    title: string;
    description: string;
    entity_id?: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string; // Add target_url parameter
  }) {
    // Avoid duplicate notifications for the same entity if one already exists
    if (event.entity_id) {
      const existing = await this.repo.findOne({ 
        where: { 
          entity_id: event.entity_id, 
          entity_type: event.entity_type, 
          type: event.type 
        } as any 
      });
      
      if (existing) {
        return existing;
      }
    }
    
    // Get users with manager and admin roles
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    
    // Create notifications for each manager and admin user
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      const saved = await this.create({
        type: event.type,
        title: event.title,
        description: event.description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url, // Pass through target_url
      } as any);
      notifications.push(saved);
    }
    
    return notifications;
  }

  async onWasteRecordsNotification(event: { 
    type: string;
    title: string;
    description: string;
    entity_id?: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string; // Add target_url parameter
  }) {
    // Avoid duplicate notifications for the same entity if one already exists
    if (event.entity_id) {
      const existing = await this.repo.findOne({ 
        where: { 
          entity_id: event.entity_id, 
          entity_type: event.entity_type, 
          type: event.type 
        } as any 
      });
      
      if (existing) {
        return existing;
      }
    }
    
    // Get users with manager and admin roles
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    
    // Create notifications for each manager and admin user
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      const saved = await this.create({
        type: event.type,
        title: event.title,
        description: event.description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url, // Pass through target_url
      } as any);
      notifications.push(saved);
    }
    
    return notifications;
  }

  async onCompanyNotification(event: { 
    type: string;
    title: string;
    description: string;
    entity_id?: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string; // Add target_url parameter
  }) {
    console.log(`📥 [NOTIFICATIONS SERVICE] Received company notification:`, JSON.stringify(event, null, 2));
    
    // Always create notifications for company events - remove duplicate detection for now
    // This ensures that all company operations generate notifications
    
    // Get users with manager and admin roles
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    console.log(`👥 [NOTIFICATIONS SERVICE] Found ${managerAndAdminUsers.length} users with manager/admin roles for company notification`);
    
    // Create notifications for each manager and admin user
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      console.log(`📝 [NOTIFICATIONS SERVICE] Creating notification for user ID: ${user.id}`);
      
      const saved = await this.create({
        type: event.type,
        title: event.title,
        description: event.description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url, // Pass through target_url
      } as any);
      notifications.push(saved);
    }
    
    console.log(`✅ [NOTIFICATIONS SERVICE] Created ${notifications.length} notifications for company event`);
    return notifications;
  }
}