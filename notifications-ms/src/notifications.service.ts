import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
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

  async getUnreadCount() {
    const count = await this.repo.count({ where: { status: 'unread' } as any });
    return { count };
  }

  async onExpiringLabel(event: { labelId: number; labelCode: string; preparationId: number; expiresAt: string }) {
    // Avoid duplicate notifications for same label if one already exists
    const existing = await this.repo.findOne({ where: { entity_id: event.labelId, entity_type: 'recipe_label', type: 'label_expiring' } as any });
    if (existing) {
      return existing;
    }
    // Create a persistent notification for expiring label
    const saved = await this.create({
      type: 'label_expiring',
      title: 'Etichetă aproape de expirare',
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
      } as any);
      notifications.push(saved);
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
      } as any);
      notifications.push(saved);
    }
    
    return notifications;
  }

  private async getUsersWithRoles(roleNames: string[]): Promise<Array<{id: number, email: string, roles: string[]}>> {
    try {
      // First get all roles
      const rolesResponse = await firstValueFrom(
        this.httpService.get('http://localhost:3003/users/roles')
      );
      
      // Filter roles by names
      const targetRoles = rolesResponse.data.filter((role: any) => 
        roleNames.includes(role.name)
      );
      
      if (targetRoles.length === 0) {
        return [];
      }
      
      // Get all user roles
      const userRolesResponse = await firstValueFrom(
        this.httpService.get('http://localhost:3003/users/user-roles')
      );
      
      // Find user IDs that have the target roles
      const targetRoleIds = targetRoles.map((role: any) => role.id);
      const targetUserIds = userRolesResponse.data
        .filter((userRole: any) => targetRoleIds.includes(userRole.roleId))
        .map((userRole: any) => userRole.userId);
      
      // Get unique user IDs
      const uniqueUserIds = [...new Set(targetUserIds)];
      
      if (uniqueUserIds.length === 0) {
        return [];
      }
      
      // Get user details for these users
      const users = [];
      for (const userId of uniqueUserIds) {
        try {
          const userResponse = await firstValueFrom(
            this.httpService.get(`http://localhost:3003/users/employee/${userId}`)
          );
          
          // Get user roles
          const userRoles = userRolesResponse.data
            .filter((userRole: any) => userRole.userId === userId)
            .map((userRole: any) => {
              const role = targetRoles.find((r: any) => r.id === userRole.roleId);
              return role ? role.name : null;
            })
            .filter(Boolean);
          
          users.push({
            id: userResponse.data.id,
            email: userResponse.data.email,
            roles: userRoles
          });
        } catch (error) {
          // Skip users that can't be fetched
          console.warn(`Could not fetch user with ID ${userId}:`, error);
        }
      }
      
      return users;
    } catch (error) {
      console.error('Error fetching users with roles:', error);
      // Return empty array if there's an error
      return [];
    }
  }

  // --- Minimal HTTP helpers to satisfy frontend ---
  async findAll() {
    return this.repo.find({ order: { created_at: 'DESC' } as any });
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
    const saved = await this.repo.save(entity);
    const count = await this.repo.count({ where: { status: 'unread' } as any });
    this.gateway.emitUnreadCount(count);
    return saved;
  }

  async markAsRead(id: number) {
    await this.repo.update({ id } as any, { status: 'read' } as any);
    const count = await this.repo.count({ where: { status: 'unread' } as any });
    this.gateway.emitUnreadCount(count);
    return { id };
  }

  async markAllAsRead() {
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
}