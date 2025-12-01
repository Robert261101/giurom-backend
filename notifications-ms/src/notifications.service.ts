import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, MoreThan, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationEntity } from './notification.entity';

@Injectable()
export class NotificationsService {
  // Cache pentru roluri și user-roles (TTL: 5 minute)
  private rolesCache: { data: any[], timestamp: number } | null = null;
  private userRolesCache: { data: any[], timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minute

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

  // Helper method pentru HTTP requests cu retry logic pentru 429 errors
  private async httpRequestWithRetry<T>(
    url: string,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(url, {
            headers: {
              'x-internal-service': 'notifications',
              'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
            }
          })
        );
        return response.data;
      } catch (error: any) {
        lastError = error;
        
        // Dacă e 429 (rate limit), așteaptă și încearcă din nou
        if (error.response?.status === 429 && attempt < maxRetries) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '0', 10);
          const delay = retryAfter > 0 
            ? retryAfter * 1000 
            : initialDelay * Math.pow(2, attempt); // Exponential backoff
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Pentru alte erori, aruncă imediat
        throw error;
      }
    }
    
    throw lastError;
  }

  async getUnreadCount(userId?: number, currentUser?: any) {
    // Always return count only for the authenticated user, not for all admins
    // This ensures each user sees only their own unread count
    const authenticatedUserId = currentUser?.userId;
    const targetUserId = userId || authenticatedUserId;
    
    if (targetUserId) {
      const count = await this.repo.count({ 
        where: { 
          status: 'unread',
          user_id: targetUserId 
        } as any 
      });
      return { count };
    }
    
    // Fallback: return 0 if no user ID provided
    return { count: 0 };
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
    // Get users with manager and admin roles
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    
    // Create notifications for each manager and admin user
    // IMPORTANT: We create notifications for ALL admins/managers, filtering happens on frontend
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      
      // Check for duplicate per user, but with a very short window (30 seconds) for updates
      // This allows multiple updates to be notified, but prevents spam from rapid-fire updates
      let existing: NotificationEntity | null = null;
      
      if (event.type.includes('updated') || event.type.includes('modified')) {
        // Very short window (5 seconds) - only prevent rapid-fire identical updates
        // This allows different updates to be notified even if they happen close together
        const fiveSecondsAgo = new Date(Date.now() - 5 * 1000);
        existing = await this.repo.findOne({ 
          where: { 
            entity_id: event.entity_id, 
            entity_type: event.entity_type, 
            type: event.type,
            user_id: user.id,
            created_at: MoreThanOrEqual(fiveSecondsAgo) as any
          } as any 
        });
      } else {
        // For non-update notifications, check for any existing duplicate (no time limit)
        existing = await this.repo.findOne({ 
          where: { 
            entity_id: event.entity_id, 
            entity_type: event.entity_type, 
            type: event.type,
            user_id: user.id
          } as any 
        });
      }
      
      if (existing) {
        notifications.push(existing);
        continue;
      }
      
      try {
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
      } catch (error) {
        // Continue processing other users even if one fails
      }
    }
    
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
      return existing;
    }
    
    // Get users with manager and admin roles for admin/manager notifications
    // For employee notifications, send directly to the employee
    let targetUsers = [];
    
    if (event.type === 'leave_request_created') {
      // Send to managers and admins
      targetUsers = await this.getUsersWithRoles(['manager', 'admin']);
    } else {
      // Send to the specific employee
      targetUsers = [{ id: event.user_id }];
    }
    
    // Create notifications for target users
    const notifications = [];
    for (const user of targetUsers) {
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
      return existing;
    }
    
    // Get users with manager and admin roles for admin/manager notifications
    // For employee notifications, send directly to the employee
    let targetUsers = [];
    
    if (event.type === 'shift_change_request_created') {
      // Send to managers and admins
      targetUsers = await this.getUsersWithRoles(['manager', 'admin']);
    } else {
      // Send to the specific employee
      targetUsers = [{ id: event.user_id }];
    }
    
    // Create notifications for target users
    const notifications = [];
    for (const user of targetUsers) {
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
    
    // Create notifications for target users
    const notifications = [];
    for (const user of uniqueTargetUsers) {
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
    // Avoid duplicate notifications for the same entity if one already exists
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
    
    // Get users with manager and admin roles for admin notifications
    // Also include the employee for whom the shift was created
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    const employeeUser = [{ id: event.user_id }];
    
    // Combine both groups (avoiding duplicates)
    const allTargetUsers = [...managerAndAdminUsers, ...employeeUser];
    const uniqueTargetUsers = allTargetUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.id === user.id)
    );
    
    // Create notifications for target users
    const notifications = [];
    for (const user of uniqueTargetUsers) {
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

  private async getUsersWithRoles(roleNames: string[]): Promise<Array<{id: number, email: string, roles: string[]}>> {
    try {
      console.log(`🔍 [NOTIFICATIONS SERVICE] Fetching users with roles: ${roleNames.join(', ')}`);
      
      const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';
      console.log(`📡 [NOTIFICATIONS SERVICE] Using API Gateway URL: ${apiGatewayUrl}`);
      
      // Get all roles (cu cache)
      let rolesData: any[];
      const now = Date.now();
      
      if (this.rolesCache && (now - this.rolesCache.timestamp) < this.CACHE_TTL) {
        console.log(`💾 [NOTIFICATIONS SERVICE] Using cached roles data`);
        rolesData = this.rolesCache.data;
      } else {
        console.log(`📥 [NOTIFICATIONS SERVICE] Fetching all roles from ${apiGatewayUrl}/users/roles`);
        const rolesResponse = await this.httpRequestWithRetry<any>(`${apiGatewayUrl}/users/roles`);
        rolesData = Array.isArray(rolesResponse) ? rolesResponse : rolesResponse.data || [];
        this.rolesCache = { data: rolesData, timestamp: now };
        console.log(`✅ [NOTIFICATIONS SERVICE] Roles response received and cached`);
      }
      
      const targetRoles = rolesData.filter((role: any) => 
        roleNames.includes(role.name)
      );
      console.log(`🎯 [NOTIFICATIONS SERVICE] Target roles found:`, JSON.stringify(targetRoles, null, 2));
      
      if (targetRoles.length === 0) {
        console.log(`⚠️ [NOTIFICATIONS SERVICE] No target roles found`);
        return [];
      }
      
      // Get all user roles (cu cache)
      let userRolesData: any[];
      
      if (this.userRolesCache && (now - this.userRolesCache.timestamp) < this.CACHE_TTL) {
        console.log(`💾 [NOTIFICATIONS SERVICE] Using cached user-roles data`);
        userRolesData = this.userRolesCache.data;
      } else {
        console.log(`📥 [NOTIFICATIONS SERVICE] Fetching user roles from ${apiGatewayUrl}/users/user-roles`);
        const userRolesResponse = await this.httpRequestWithRetry<any>(`${apiGatewayUrl}/users/user-roles`);
        userRolesData = Array.isArray(userRolesResponse) ? userRolesResponse : userRolesResponse.data || [];
        this.userRolesCache = { data: userRolesData, timestamp: now };
        console.log(`✅ [NOTIFICATIONS SERVICE] User roles response received and cached`);
      }
      
      // Find user IDs that have the target roles
      const targetRoleIds = targetRoles.map((role: any) => role.id);
      const targetUserIds = userRolesData
        .filter((userRole: any) => targetRoleIds.includes(userRole.roleId))
        .map((userRole: any) => userRole.userId);
      
      // Get unique user IDs
      const uniqueUserIds = [...new Set(targetUserIds)];
      console.log(`🔢 [NOTIFICATIONS SERVICE] Unique user IDs: ${uniqueUserIds.length}`);
      
      if (uniqueUserIds.length === 0) {
        console.log(`⚠️ [NOTIFICATIONS SERVICE] No users found with target roles`);
        return [];
      }
      
      // Get user details for these users (cu delay mic între request-uri pentru a evita rate limiting)
      const users = [];
      for (let i = 0; i < uniqueUserIds.length; i++) {
        const userId = uniqueUserIds[i];
        try {
          // Adaugă un delay mic între request-uri (50ms) pentru a evita rate limiting
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          const userResponse = await this.httpRequestWithRetry<any>(`${apiGatewayUrl}/users/${userId}`);
          const userData = userResponse.data || userResponse;
          
          // Get user roles
          const userRoles = userRolesData
            .filter((userRole: any) => userRole.userId === userId)
            .map((userRole: any) => {
              const role = targetRoles.find((r: any) => r.id === userRole.roleId);
              return role ? role.name : null;
            })
            .filter(Boolean);
          
          users.push({
            id: userData.id,
            email: userData.email,
            roles: userRoles
          });
        } catch (error) {
          // Skip users that can't be fetched
        }
      }
      
      return users;
    } catch (error) {
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

  // Helper method to get user roles from API Gateway
  private async getUserRoles(userId: number): Promise<string[]> {
    try {
      const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';
      const userRolesResponse = await this.httpRequestWithRetry<any>(`${apiGatewayUrl}/users/user-roles`);
      const userRolesData = Array.isArray(userRolesResponse) ? userRolesResponse : userRolesResponse.data || [];
      
      // Get all roles
      const rolesResponse = await this.httpRequestWithRetry<any>(`${apiGatewayUrl}/users/roles`);
      const rolesData = Array.isArray(rolesResponse) ? rolesResponse : rolesResponse.data || [];
      
      // Find user's role IDs
      const userRoleIds = userRolesData
        .filter((ur: any) => ur.userId === userId)
        .map((ur: any) => ur.roleId);
      
      // Map role IDs to role names
      const roleNames = rolesData
        .filter((role: any) => userRoleIds.includes(role.id))
        .map((role: any) => role.name);
      
      return roleNames;
    } catch (error) {
      return [];
    }
  }

  // --- Minimal HTTP helpers to satisfy frontend ---
  async findAll(userId?: number, currentUser?: any) {
    // Always check the authenticated user's roles (from req.user), not the userId from query params
    let isAdminOrManager = false;
    const authenticatedUserId = currentUser?.userId;
    
    // Calculate date 48 hours ago (48 * 60 * 60 * 1000 milliseconds)
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    if (authenticatedUserId) {
      const userRoles = await this.getUserRoles(authenticatedUserId);
      isAdminOrManager = userRoles.some((role: string) => 
        role.toLowerCase() === 'admin' || role.toLowerCase() === 'manager'
      );
    }

    if (isAdminOrManager) {
      // Get all admin/manager user IDs
      const adminManagerUsers = await this.getUsersWithRoles(['admin', 'manager']);
      const adminManagerUserIds = adminManagerUsers.map(u => u.id);
      
      if (adminManagerUserIds.length > 0) {
        // Use query builder for IN clause with filtering:
        // - All unread notifications
        // - Read notifications only from last 48 hours
        return this.repo
          .createQueryBuilder('notification')
          .where('notification.user_id IN (:...userIds)', { userIds: adminManagerUserIds })
          .andWhere(
            '(notification.status = :unreadStatus OR (notification.status = :readStatus AND notification.created_at >= :fortyEightHoursAgo))',
            {
              unreadStatus: 'unread',
              readStatus: 'read',
              fortyEightHoursAgo: fortyEightHoursAgo
            }
          )
          .orderBy('notification.created_at', 'DESC')
          .getMany();
      }
    }

    // If not admin/manager, return notifications only for the authenticated user (or userId from query if provided)
    const targetUserId = userId || authenticatedUserId;
    if (targetUserId) {
      // Filter: all unread + read from last 48 hours
      return this.repo
        .createQueryBuilder('notification')
        .where('notification.user_id = :targetUserId', { targetUserId })
        .andWhere(
          '(notification.status = :unreadStatus OR (notification.status = :readStatus AND notification.created_at >= :fortyEightHoursAgo))',
          {
            unreadStatus: 'unread',
            readStatus: 'read',
            fortyEightHoursAgo: fortyEightHoursAgo
          }
        )
        .orderBy('notification.created_at', 'DESC')
        .getMany();
    }
    
    // Fallback: return all with same filtering
    return this.repo
      .createQueryBuilder('notification')
      .where(
        '(notification.status = :unreadStatus OR (notification.status = :readStatus AND notification.created_at >= :fortyEightHoursAgo))',
        {
          unreadStatus: 'unread',
          readStatus: 'read',
          fortyEightHoursAgo: fortyEightHoursAgo
        }
      )
      .orderBy('notification.created_at', 'DESC')
      .getMany();
  }

  async create(notification: Partial<NotificationEntity>) {
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
    
    const saved = (await this.repo.save(entity)) as unknown as NotificationEntity;
    
    // Emit new notification to specific user via WebSocket
    if (saved.user_id) {
      try {
        const notificationData = {
          id: saved.id,
          type: saved.type,
          title: saved.title,
          description: saved.description,
          status: saved.status,
          entity_id: saved.entity_id,
          entity_type: saved.entity_type,
          target_url: saved.target_url,
          priority: saved.priority,
          created_at: saved.created_at,
          user_id: saved.user_id
        };
        
        await this.gateway.emitNewNotification(saved.user_id, notificationData);
        
        // Also emit unread count update for this user
        const count = await this.repo.count({ 
          where: { 
            status: 'unread',
            user_id: saved.user_id 
          } as any 
        });
        this.gateway.emitUnreadCountForUser(saved.user_id, count);
      } catch (error) {
        // Don't throw - notification is saved in DB, WebSocket is just a bonus
      }
    }
    
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
    try {
      // Get users with manager and admin roles
      const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
      
      if (managerAndAdminUsers.length === 0) {
        return;
      }
      
      // Check for files expiring in 7 days
      await this.checkFilesExpiringInDays(7, managerAndAdminUsers);
      
      // Check for already expired files
      await this.checkExpiredFiles(managerAndAdminUsers);
    } catch (error) {
      // Silent error handling
    }
  }
  
  // Check for files expiring in a specific number of days
  private async checkFilesExpiringInDays(days: number, users: Array<{id: number, email: string, roles: string[]}>) {
    
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
    } catch (error) {
      // Silent error handling
    }
  }
  
  // Check for already expired files
  private async checkExpiredFiles(users: Array<{id: number, email: string, roles: string[]}>) {
    
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
    } catch (error) {
      // Silent error handling
    }
  }
  
  // Check company documents expiring
  private async checkCompanyDocumentsExpiring(targetDate: string, days: number, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
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
    } catch (error) {
      // Silent error handling
    }
  }
  
  // Check location files expiring
  private async checkLocationFilesExpiring(targetDate: string, days: number, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
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
    } catch (error) {
      // Silent error handling
    }
  }
  
  // Check employee files expiring
  private async checkEmployeeFilesExpiring(targetDate: string, days: number, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
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
    } catch (error) {
      // Silent error handling
    }
  }
  
  // Check supplier documents expiring
  private async checkSupplierDocumentsExpiring(targetDate: string, days: number, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
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
    } catch (error) {
      // Silent error handling
    }
  }
  
  // Check company documents expired
  private async checkCompanyDocumentsExpired(today: string, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
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
    } catch (error) {
      // Silent error handling
    }
  }
  
  // Check location files expired
  private async checkLocationFilesExpired(today: string, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
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
    } catch (error) {
      // Silent error handling
    }
  }
  
  // Check employee files expired
  private async checkEmployeeFilesExpired(today: string, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
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
    } catch (error) {
      // Silent error handling
    }
  }
  
  // Check supplier documents expired
  private async checkSupplierDocumentsExpired(today: string, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
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
    } catch (error) {
      // Silent error handling
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
    // console.log(`📥 [NOTIFICATIONS SERVICE] Received company notification:`, JSON.stringify(event, null, 2));
    
    // Always create notifications for company events - remove duplicate detection for now
    // This ensures that all company operations generate notifications
    
    // Get users with manager and admin roles
    const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
    // console.log(`👥 [NOTIFICATIONS SERVICE] Found ${managerAndAdminUsers.length} users with manager/admin roles for company notification`);
    
    // Create notifications for each manager and admin user
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      // console.log(`📝 [NOTIFICATIONS SERVICE] Creating notification for user ID: ${user.id}`);
      
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
    
    // console.log(`✅ [NOTIFICATIONS SERVICE] Created ${notifications.length} notifications for company event`);
    return notifications;
  }
}