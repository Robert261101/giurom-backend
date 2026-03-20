import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, MoreThan, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsGateway } from './notifications.gateway';
import { UserResolutionService } from './user-resolution.service';
import { NotificationEntity } from './notification.entity';
import { PushService } from './push/push.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  // Cache pentru roluri și user-roles (TTL: 5 minute)
  private rolesCache: { data: any[], timestamp: number } | null = null;
  private userRolesCache: { data: any[], timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minute
  /** Pentru notificări "document expirat" nu duplicăm dacă există deja una în ultimele 7 zile */
  private readonly EXPIRED_DOC_DEDUPE_DAYS = 7;

  constructor(
    private readonly gateway: NotificationsGateway,
    private readonly httpService: HttpService,
    private readonly userResolution: UserResolutionService,
    private readonly pushService: PushService,
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
    const authenticatedUserId = currentUser?.userId;
    const rawUserId = userId ?? authenticatedUserId;
    if (rawUserId == null) return { count: 0 };
    const resolvedUserId = await this.userResolution.resolveToUserId(rawUserId);
    const userIds = [resolvedUserId, rawUserId].filter((id, i, a) => id != null && a.indexOf(id) === i);
    if (userIds.length === 0) return { count: 0 };
    const count = await this.repo
      .createQueryBuilder('n')
      .where('n.status = :status', { status: 'unread' })
      .andWhere('n.user_id IN (:...userIds)', { userIds })
      .getCount();
    return { count };
  }

  async onExpiringLabel(event: { labelId: number; labelCode: string; preparationId: number; expiresAt: string }) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const targetUsers = await this.getUsersWithRoles(['admin', 'manager']);
    const created = [];
    for (const user of targetUsers) {
      const existing = await this.repo.findOne({
        where: {
          entity_id: event.labelId,
          entity_type: 'recipe_label',
          type: 'label_expiring',
          user_id: user.id,
          created_at: MoreThanOrEqual(fiveMinutesAgo) as any,
        } as any,
      });
      if (existing) continue;
      const saved = await this.create({
        type: 'label_expiring',
        title: 'Eticheta aproape de expirare',
        description: `Eticheta ${event.labelCode} va expira la ${new Date(event.expiresAt).toLocaleString('ro-RO')}`,
        user_id: user.id,
        entity_id: event.labelId,
        entity_type: 'recipe_label',
        target_url: '/retetar/istoric-etichete',
        metadata: { preparationId: event.preparationId, labelCode: event.labelCode, expiresAt: event.expiresAt },
        priority: 'high',
        status: 'unread',
        expires_at: event.expiresAt as any,
      } as any);
      created.push(saved);
    }
    return created;
  }

  async onLabelExpired(event: { labelId: number; labelCode: string; preparationId: number; expiresAt: string }) {
    const targetUsers = await this.getUsersWithRoles(['admin', 'manager']);
    const created = [];
    for (const user of targetUsers) {
      const existing = await this.repo.findOne({
        where: {
          entity_id: event.labelId,
          entity_type: 'recipe_label',
          type: 'label_expired',
          user_id: user.id,
        } as any,
      });
      if (existing) continue;
      const saved = await this.create({
        type: 'label_expired',
        title: 'Eticheta a expirat',
        description: `Eticheta ${event.labelCode} a expirat la ${new Date(event.expiresAt).toLocaleString('ro-RO')}`,
        user_id: user.id,
        entity_id: event.labelId,
        entity_type: 'recipe_label',
        target_url: '/retetar/istoric-etichete',
        metadata: { preparationId: event.preparationId, labelCode: event.labelCode, expiresAt: event.expiresAt },
        priority: 'high',
        status: 'unread',
      } as any);
      created.push(saved);
    }
    return created;
  }

  async onRecipeNotification(event: { 
    type: string;
    title: string;
    description: string;
    user_id?: number;
    entity_id: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string;
  }) {
    const adminOnly = event.metadata?.audience === 'admin_only' ||
      (event.entity_type === 'recipe' && ['recipe_created', 'recipe_updated', 'recipe_deleted'].includes(event.type));
    const roleNames = adminOnly ? ['admin'] : ['admin', 'manager'];
    const workLocationId = event.metadata?.work_location_id ?? null;
    let targetUsers =
      workLocationId != null
        ? await this.getUsersWithAccessToLocation(roleNames, workLocationId)
        : await this.getUsersWithRoles(roleNames);
    if (targetUsers.length === 0 && workLocationId != null)
      targetUsers = await this.getUsersWithRoles(roleNames);

    // Deduplicare per user (5 min pentru update, altfel orice duplicate)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isUpdateType = event.type.includes('updated') || event.type.includes('modified');
    const notifications = [];
    for (const user of targetUsers) {
      let existing: NotificationEntity | null = null;
      if (isUpdateType) {
        existing = await this.repo.findOne({
          where: {
            entity_id: event.entity_id,
            entity_type: event.entity_type,
            type: event.type,
            user_id: user.id,
            created_at: MoreThanOrEqual(fiveMinutesAgo) as any,
          } as any,
        });
      } else {
        existing = await this.repo.findOne({
          where: {
            entity_id: event.entity_id,
            entity_type: event.entity_type,
            type: event.type,
            user_id: user.id,
          } as any,
        });
      }
      if (existing) continue;
      const { title, description } = await this.prefixWithLocation(
        event.title,
        event.description,
        workLocationId,
        event.metadata,
      );
      const saved = await this.create({
        type: event.type,
        title,
        description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url,
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
    target_url?: string;
  }) {
    const isMovement = event.type.startsWith('stock_in_') || event.type.startsWith('stock_out_');
    if (!isMovement) {
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
        existing = await this.repo.findOne({ 
          where: { 
            entity_id: event.entity_id, 
            entity_type: event.entity_type, 
            type: event.type 
          } as any 
        });
      }
      if (existing) return existing;
    }

    const workLocationId = event.metadata?.work_location_id ?? null;
    let targetUsers =
      workLocationId != null
        ? await this.getUsersWithAccessToLocation(['manager', 'admin'], workLocationId)
        : await this.getUsersWithRoles(['manager', 'admin']);
    if (targetUsers.length === 0 && workLocationId != null)
      targetUsers = await this.getUsersWithRoles(['manager', 'admin']);
    const { title, description } = await this.prefixWithLocation(
      event.title,
      event.description,
      workLocationId,
      event.metadata,
    );
    const notifications = [];
    for (const user of targetUsers) {
      const saved = await this.create({
        type: event.type,
        title,
        description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url ?? '/stoc',
      } as any);
      notifications.push(saved);
    }
    return notifications;
  }

  /**
   * Notificări locații și încasări: doar adminul de la firma care are locația (sau admini cu acea locație).
   * Locații: creare, modificare, ștergere. Încasări: trimisă, aprobată, respinsă.
   * Folosește work_location_id pentru a trimite doar la adminii care au acea locație.
   */
  async onLocationNotification(event: {
    type: string;
    title: string;
    description: string;
    entity_id: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string;
  }) {
    const workLocationId =
      event.entity_type === 'location'
        ? event.entity_id
        : event.metadata?.work_location_id ?? null;
    let targetUsers =
      workLocationId != null
        ? await this.getUsersWithAccessToLocation(['admin'], workLocationId)
        : [];
    if (targetUsers.length === 0) {
      this.logger.log(
        `[locations.notification] Niciun admin pe locația ${workLocationId ?? 'N/A'}, fallback la toți adminii`,
      );
      targetUsers = await this.getUsersWithRoles(['admin']);
    }
    const notifications = [];
    for (const user of targetUsers) {
      
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

      const { title, description } = await this.prefixWithLocation(
        event.title,
        event.description,
        workLocationId,
        event.metadata,
      );
      try {
        const saved = await this.create({
          type: event.type,
          title,
          description,
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

  /**
   * Notificări furnizor: doar admin – la creare, modificare, ștergere furnizor și la comanda furnizor.
   * Dacă metadata.work_location_id este prezent, notifică doar adminii de la acea locație.
   */
  async onSupplierNotification(event: {
    type: string;
    title: string;
    description: string;
    entity_id: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string;
  }) {
    const workLocationId = event.metadata?.work_location_id ?? null;
    let targetUsers =
      workLocationId != null
        ? await this.getUsersWithAccessToLocation(['admin'], workLocationId)
        : await this.getUsersWithRoles(['admin']);
    if (targetUsers.length === 0 && workLocationId != null)
      targetUsers = await this.getUsersWithRoles(['admin']);
    const { title, description } = await this.prefixWithLocation(
      event.title,
      event.description,
      workLocationId,
      event.metadata,
    );
    const notifications = [];
    for (const user of targetUsers) {
      const saved = await this.create({
        type: event.type,
        title,
        description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url,
      } as any);
      notifications.push(saved);
    }
    return notifications;
  }

  /**
   * Notificări comenzi: admini/manageri din locație; dacă niciunul nu e găsit pe locație, fallback la toți adminii/managerii.
   * - order_received_total, order_received_partial, order_cancelled -> admin + manager
   * - order_reception_approved, order_reception_rejected -> doar admin
   */
  async onOrderNotification(event: {
    type: string;
    title: string;
    description: string;
    work_location_id: number;
    entity_id: number;
    entity_type: string;
    metadata?: any;
    priority?: 'low' | 'medium' | 'high';
    target_url?: string;
  }) {
    const workLocationId = event.work_location_id;
    const adminOnly = event.type === 'order_reception_approved' || event.type === 'order_reception_rejected';
    const roleNames = adminOnly ? ['admin'] : ['admin', 'manager'];

    let targetUsers = workLocationId != null
      ? await this.getUsersWithAccessToLocation(roleNames, workLocationId)
      : [];
    if (targetUsers.length === 0) {
      this.logger.log(`[orders.notification] Niciun admin/manager pe locația ${workLocationId ?? 'N/A'}, fallback la toți rolurile: ${roleNames.join(', ')}`);
      targetUsers = await this.getUsersWithRoles(roleNames);
    }
    if (targetUsers.length === 0) {
      this.logger.warn('[orders.notification] Niciun utilizator găsit pentru rolurile cerute, notificare omisă');
      return;
    }
    const { title, description } = await this.prefixWithLocation(
      event.title,
      event.description,
      workLocationId,
      event.metadata,
    );
    for (const user of targetUsers) {
      await this.create({
        type: event.type,
        title,
        description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type ?? 'supplier_order',
        metadata: event.metadata,
        priority: event.priority ?? 'medium',
        status: 'unread',
        target_url: event.target_url ?? '/comenzi',
      } as any);
    }
  }

  async onLeaveNotification(event: { 
    type: string;
    title: string;
    description: string;
    user_id: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string;
  }) {
    const entityId = event.metadata?.requestId || event.user_id;
    const employeeId = event.metadata?.employeeId ?? event.user_id;

    let targetUsers: Array<{ id: number; email?: string; roles?: string[] }>;
    const workLocationId = event.metadata?.work_location_id ?? null;

    if (event.type === 'leave_request_created') {
      targetUsers =
        workLocationId != null
          ? await this.getUsersWithAccessToLocation(['manager', 'admin'], workLocationId)
          : await this.getUsersWithRoles(['manager', 'admin']);
    } else {
      // Aprobare/respingere: doar angajatul (rezolvăm employee_id -> user_id)
      let userId: number | null = null;
      try {
        const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';
        const res = await firstValueFrom(
          this.httpService.get(`${apiGatewayUrl}/users/employee/${employeeId}`, {
            headers: {
              'x-internal-service': 'notifications',
              'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
            },
          })
        );
        const user = res.data?.data ?? res.data;
        if (user?.id) userId = user.id;
      } catch (e: any) {
        this.logger.warn(`[leave.notification] Nu s-a putut rezolva user_id pentru employee ${employeeId}: ${e?.message || e}`);
      }
      targetUsers = userId != null ? [{ id: userId, email: '', roles: [] }] : [];
    }

    const { title, description } = await this.prefixWithLocation(
      event.title,
      event.description,
      workLocationId,
      event.metadata,
    );
    const notifications = [];
    for (const user of targetUsers) {
      const existing = await this.repo.findOne({
        where: { entity_id: entityId, entity_type: event.entity_type, type: event.type, user_id: user.id } as any,
      });
      if (existing) continue;
      const saved = await this.create({
        type: event.type,
        title,
        description,
        user_id: user.id,
        entity_id: entityId,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url ?? '/cereri-concedii',
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
    target_url?: string;
  }) {
    const entityId = event.metadata?.requestId || event.user_id;
    const employeeId = event.metadata?.employeeId ?? event.user_id;

    let targetUsers: Array<{ id: number; email?: string; roles?: string[] }>;
    const workLocationId = event.metadata?.work_location_id ?? null;

    if (event.type === 'shift_change_request_created') {
      targetUsers =
        workLocationId != null
          ? await this.getUsersWithAccessToLocation(['manager', 'admin'], workLocationId)
          : await this.getUsersWithRoles(['manager', 'admin']);
    } else {
      // Aprobare/respingere: doar angajatul (rezolvăm employee_id -> user_id)
      let userId: number | null = null;
      try {
        const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';
        const res = await firstValueFrom(
          this.httpService.get(`${apiGatewayUrl}/users/employee/${employeeId}`, {
            headers: {
              'x-internal-service': 'notifications',
              'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
            },
          })
        );
        const user = res.data?.data ?? res.data;
        if (user?.id) userId = user.id;
      } catch (e: any) {
        this.logger.warn(`[shift-change.notification] Nu s-a putut rezolva user_id pentru employee ${employeeId}: ${e?.message || e}`);
      }
      targetUsers = userId != null ? [{ id: userId, email: '', roles: [] }] : [];
    }

    const { title, description } = await this.prefixWithLocation(
      event.title,
      event.description,
      workLocationId,
      event.metadata,
    );
    const notifications = [];
    for (const user of targetUsers) {
      const existing = await this.repo.findOne({
        where: { entity_id: entityId, entity_type: event.entity_type, type: event.type, user_id: user.id } as any,
      });
      if (existing) continue;
      const saved = await this.create({
        type: event.type,
        title,
        description,
        user_id: user.id,
        entity_id: entityId,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url ?? '/cereri-schimb-tura',
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

    const workLocationId = event.metadata?.work_location_id ?? null;
    const managerAndAdminUsers =
      workLocationId != null
        ? await this.getUsersWithAccessToLocation(['manager', 'admin'], workLocationId)
        : await this.getUsersWithRoles(['manager', 'admin']);
    const employeeUser = [{ id: event.user_id }];
    
    // Combine both groups (avoiding duplicates)
    const allTargetUsers = [...managerAndAdminUsers, ...employeeUser];
    const uniqueTargetUsers = allTargetUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.id === user.id)
    );
    
    const { title, description } = await this.prefixWithLocation(
      event.title,
      event.description,
      workLocationId,
      event.metadata,
    );
    const notifications = [];
    for (const user of uniqueTargetUsers) {
      const saved = await this.create({
        type: event.type,
        title,
        description,
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
    // Rezolvă employee_id -> user_id (attendance-ms trimite employee_id ca user_id)
    const employeeId = event.metadata?.employeeId ?? event.user_id;
    let userId: number | null = event.user_id;
    if (employeeId != null) {
      try {
        const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';
        const url = `${apiGatewayUrl}/users/employee/${employeeId}`;
        this.logger.log(`[shift.notification] Rezolv user_id pentru employee ${employeeId}: GET ${url}`);
        const res = await firstValueFrom(
          this.httpService.get(url, {
            headers: {
              'x-internal-service': 'notifications',
              'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
            },
          })
        );
        const user = res.data?.data ?? res.data;
        if (user?.id) {
          userId = user.id;
          this.logger.log(`[shift.notification] Rezolvat: employee ${employeeId} -> user_id=${userId}`);
        }
      } catch (e: any) {
        this.logger.warn(`[shift.notification] Nu s-a putut rezolva user_id pentru employee ${employeeId}: ${e?.message || e}`);
      }
    }

    const workLocationId = event.metadata?.work_location_id ?? null;
    const managerAndAdminUsers =
      workLocationId != null
        ? await this.getUsersWithAccessToLocation(['manager', 'admin'], workLocationId)
        : await this.getUsersWithRoles(['manager', 'admin']);
    const employeeUser = userId != null ? [{ id: userId, email: '', roles: [] }] : [];

    const allTargetUsers = [...managerAndAdminUsers, ...employeeUser];
    const uniqueTargetUsers = allTargetUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.id === user.id)
    );
    
    const notifications = [];
    for (const user of uniqueTargetUsers) {
      // Evită duplicat per user: doar dacă acest user nu are deja notificare pentru acest (entity, type)
      const existingForUser = await this.repo.findOne({
        where: {
          entity_id: event.entity_id,
          entity_type: event.entity_type,
          type: event.type,
          user_id: user.id,
        } as any,
      });
      if (existingForUser) continue;

      const { title, description } = await this.prefixWithLocation(
        event.title,
        event.description,
        workLocationId,
        event.metadata,
      );
      const saved = await this.create({
        type: event.type,
        title,
        description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url,
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

      // Un singur user poate avea mai multe roluri (manager + admin) – asigură un rezultat per user_id
      const byId = new Map<number, { id: number; email: string; roles: string[] }>();
      for (const u of users) {
        if (!byId.has(u.id)) byId.set(u.id, u);
      }
      const uniqueUsers = [...byId.values()];
      if (uniqueUsers.length !== users.length) {
        this.logger.log(`🔢 [NOTIFICATIONS SERVICE] Deduplicat manageri/admins: ${users.length} -> ${uniqueUsers.length} utilizatori unici`);
      }
      return uniqueUsers;
    } catch (error) {
      // Return empty array if there's an error
      return [];
    }
  }

  /**
   * Elimină un prefix existent "[...]: " de la începutul textului, ca să nu dublăm locația.
   */
  private stripLocationPrefix(text: string | null | undefined): string {
    if (text == null || typeof text !== 'string') return '';
    const trimmed = text.trim();
    const match = trimmed.match(/^\[[^\]]+\]:\s*/);
    return match ? trimmed.slice(match[0].length).trim() : trimmed;
  }

  /**
   * Returnează numele locației: din metadata.location_name sau GET /locations/:id.
   */
  private async getLocationName(
    workLocationId: number,
    metadata?: { location_name?: string; [k: string]: any },
  ): Promise<string> {
    if (metadata?.location_name && String(metadata.location_name).trim()) {
      return String(metadata.location_name).trim();
    }
    try {
      const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';
      const loc = await this.httpRequestWithRetry<any>(
        `${apiGatewayUrl}/locations/${workLocationId}`,
      );
      const data = loc?.data ?? loc;
      const name = data?.location_name ?? data?.locationName ?? data?.name;
      return name != null ? String(name).trim() : `Locație ${workLocationId}`;
    } catch (e: any) {
      this.logger.warn(`[notifications] getLocationName(${workLocationId}): ${e?.message || e}`);
      return `Locație ${workLocationId}`;
    }
  }

  /**
   * Prefixează doar title-ul cu "[Nume Locație]: " când există work_location_id.
   * Description rămâne fără prefix ca în UI să nu apară locația de două ori (title + description).
   */
  private async prefixWithLocation(
    title: string,
    description: string | null | undefined,
    workLocationId: number | null,
    metadata?: { location_name?: string; [k: string]: any },
  ): Promise<{ title: string; description: string }> {
    if (workLocationId == null) {
      return { title: title || 'Notificare', description: description ?? '' };
    }
    const locationName = await this.getLocationName(workLocationId, metadata);
    const prefix = `[${locationName}]: `;
    const titleClean = this.stripLocationPrefix(title || 'Notificare');
    const descClean = this.stripLocationPrefix(description ?? '');
    return {
      title: prefix + titleClean,
      description: descClean,
    };
  }

  /**
   * Returnează userii cu rolurile date care au acces la locația work_location_id:
   * - au acea locație în setul de locații (work_location_default_id sau employees_locations),
   * - sau au acces la cel puțin o locație din aceeași companie (acces la nivel de companie).
   */
  private async getUsersWithAccessToLocation(
    roleNames: string[],
    workLocationId: number,
  ): Promise<Array<{ id: number; email: string; roles: string[] }>> {
    try {
      const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';
      const wlId = Number(workLocationId);
      const usersWithRoles = await this.getUsersWithRoles(roleNames);
      if (usersWithRoles.length === 0) return [];

      // Locațiile companiei (pentru acces la nivel companie)
      let companyLocationIds: number[] = [];
      try {
        const locResponse = await this.httpRequestWithRetry<any>(`${apiGatewayUrl}/locations/${wlId}`);
        const locData = locResponse?.data ?? locResponse;
        const companyId = locData?.company_id ?? locData?.companyId;
        if (companyId != null) {
          const listResponse = await this.httpRequestWithRetry<any>(
            `${apiGatewayUrl}/locations?companyId=${companyId}&limit=500`,
          );
          const list = listResponse?.data ?? listResponse?.locations ?? listResponse ?? [];
          const arr = Array.isArray(list) ? list : (list?.data ?? []);
          companyLocationIds = arr.map((l: any) => l?.id ?? l?.location_id).filter((id: any) => id != null);
          if (!companyLocationIds.includes(wlId)) companyLocationIds.push(wlId);
        } else {
          companyLocationIds = [wlId];
        }
      } catch {
        companyLocationIds = [wlId];
      }

      const result: Array<{ id: number; email: string; roles: string[] }> = [];
      const headers = {
        'x-internal-service': 'notifications',
        'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
      };

      for (let i = 0; i < usersWithRoles.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 30));
        const user = usersWithRoles[i];
        try {
          const userResponse = await firstValueFrom(
            this.httpService.get(`${apiGatewayUrl}/users/${user.id}`, { headers }),
          );
          const userData = userResponse?.data ?? userResponse;
          const idEmployee = userData?.id_employee ?? userData?.idEmployee;
          if (idEmployee == null) continue;

          const locationIds: number[] = [];
          try {
            const empResponse = await firstValueFrom(
              this.httpService.get(`${apiGatewayUrl}/employees/${idEmployee}`, { headers }),
            );
            const emp = empResponse?.data ?? empResponse;
            const defaultLoc = emp?.work_location_default_id ?? emp?.workLocationDefaultId;
            if (defaultLoc != null) locationIds.push(Number(defaultLoc));
          } catch {
            // skip
          }
          try {
            const locsResponse = await firstValueFrom(
              this.httpService.get(`${apiGatewayUrl}/employees/${idEmployee}/locations`, { headers }),
            );
            const locs = locsResponse?.data ?? locsResponse;
            const arr = Array.isArray(locs) ? locs : (locs?.data ?? []);
            arr.forEach((item: any) => {
              const idLoc = item?.idLocation ?? item?.id_location ?? item?.work_location_id;
              if (idLoc != null && !locationIds.includes(Number(idLoc))) locationIds.push(Number(idLoc));
            });
          } catch {
            // skip
          }

          const hasDirectAccess = locationIds.includes(wlId);
          const hasCompanyAccess = companyLocationIds.some((id) => locationIds.includes(id));
          if (hasDirectAccess || hasCompanyAccess) {
            result.push(user);
          }
        } catch {
          // skip user
        }
      }

      this.logger.log(
        `[notifications] getUsersWithAccessToLocation locație ${workLocationId}, roluri [${roleNames.join(',')}]: ${result.length} utilizatori`,
      );
      return result;
    } catch (e) {
      this.logger.warn(`[notifications] getUsersWithAccessToLocation: ${(e as Error)?.message}`);
      return [];
    }
  }

  /**
   * Notificări pentru sarcini (tasks): trimise către angajatul asignat (assigned_to_id -> user_id).
   * Payload: type, title, description, entity_id, entity_type, metadata (assignedToId = employee_id), priority, target_url.
   * Opțional: user_id (dacă e deja rezolvat în veziv-tasks).
   */
  async onTaskNotification(event: {
    type: string;
    title: string;
    description: string;
    entity_id?: number;
    entity_type?: string;
    metadata?: { assignedToId?: number; [k: string]: any };
    priority?: 'low' | 'medium' | 'high';
    target_url?: string;
    user_id?: number;
  }) {
    this.logger.log(
      `📥 [tasks.notification] Primit: type=${event.type}, entity_id=${event.entity_id}, assignedToId=${event.metadata?.assignedToId ?? 'null'}, user_id=${event.user_id ?? 'null'}`,
    );

    if (event.type === 'assignment.reassigned_manager_info') {
      const entityType = event.entity_type ?? 'task_assignment';
      const targetUrl = event.target_url ?? (event.entity_id ? `/sarcini/${event.entity_id}` : '/sarcini');
      const taskWorkLocationId = event.metadata?.work_location_id ?? null;
      const managerAndAdminUsers =
        taskWorkLocationId != null
          ? await this.getUsersWithAccessToLocation(['manager', 'admin'], taskWorkLocationId)
          : await this.getUsersWithRoles(['manager', 'admin']);
      const { title, description } = await this.prefixWithLocation(
        event.title,
        event.description,
        taskWorkLocationId,
        event.metadata,
      );
      for (const user of managerAndAdminUsers) {
        await this.create({
          type: event.type,
          title,
          description,
          user_id: user.id,
          entity_id: event.entity_id ?? null,
          entity_type: entityType,
          metadata: event.metadata ?? null,
          priority: (event.priority as any) ?? 'medium',
          status: 'unread',
          target_url: targetUrl,
        } as any);
      }
      return;
    }

    let userId = event.user_id;
    if (userId == null && event.metadata?.assignedToId != null) {
      const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';
      const url = `${apiGatewayUrl}/users/employee/${event.metadata.assignedToId}`;
      const maxAttempts = 3;
      const retryDelayMs = 400;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          this.logger.log(`🔍 [tasks.notification] Rezolv user_id pentru employee ${event.metadata.assignedToId} (încercare ${attempt}/${maxAttempts}): GET ${url}`);
          const res = await firstValueFrom(
            this.httpService.get(url, {
              headers: {
                'x-internal-service': 'notifications',
                'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
              },
              timeout: 8000,
            })
          );
          const user = res.data?.data ?? res.data;
          if (user?.id) {
            userId = user.id;
            this.logger.log(`✅ [tasks.notification] Rezolvat: employee ${event.metadata.assignedToId} -> user_id=${userId}`);
            break;
          }
          this.logger.warn(`[tasks.notification] Răspuns fără user.id: ${JSON.stringify(res.data)}`);
        } catch (e: any) {
          this.logger.warn(`[tasks.notification] Încercare ${attempt}/${maxAttempts} eșuată pentru employee ${event.metadata.assignedToId}: ${e?.message || e}`);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, retryDelayMs));
          } else {
            this.logger.error(`[tasks.notification] Nu s-a putut rezolva user_id pentru employee ${event.metadata.assignedToId} după ${maxAttempts} încercări – notificarea nu va fi trimisă`);
            return;
          }
        }
      }
    }
    const entityType = event.entity_type ?? (event.type?.startsWith?.('template.') ? 'task_template' : 'task_assignment');
    const targetUrl = event.target_url ?? (entityType === 'task_template' ? '/sarcini/new' : (event.entity_id ? `/sarcini/${event.entity_id}` : '/sarcini'));

    if (userId != null) {
      const taskWorkLocationId = event.metadata?.work_location_id ?? null;
      const { title, description } = await this.prefixWithLocation(
        event.title,
        event.description,
        taskWorkLocationId,
        event.metadata,
      );
      this.logger.log(`📝 [tasks.notification] Creez notificare pentru user_id=${userId}, title="${title}"`);
      await this.create({
        type: event.type,
        title,
        description,
        user_id: userId,
        entity_id: event.entity_id ?? null,
        entity_type: entityType,
        metadata: event.metadata ?? null,
        priority: (event.priority as any) ?? 'medium',
        status: 'unread',
        target_url: targetUrl,
      } as any);
      if (event.type === 'execution.created') {
        const managerAndAdminUsers =
          taskWorkLocationId != null
            ? await this.getUsersWithAccessToLocation(['manager', 'admin'], taskWorkLocationId)
            : await this.getUsersWithRoles(['manager', 'admin']);
        const { title: execTitle, description: execDesc } = await this.prefixWithLocation(
          'Task finalizat',
          event.description,
          taskWorkLocationId,
          event.metadata,
        );
        for (const user of managerAndAdminUsers) {
          if (user.id === userId) continue;
          await this.create({
            type: event.type,
            title: execTitle,
            description: execDesc,
            user_id: user.id,
            entity_id: event.entity_id ?? null,
            entity_type: entityType,
            metadata: event.metadata ?? null,
            priority: (event.priority as any) ?? 'medium',
            status: 'unread',
            target_url: targetUrl,
          } as any);
        }
      }
      if (event.type === 'assignment.auto_postponed') {
        const managerAndAdminUsers =
          taskWorkLocationId != null
            ? await this.getUsersWithAccessToLocation(['manager', 'admin'], taskWorkLocationId)
            : await this.getUsersWithRoles(['manager', 'admin']);
        for (const user of managerAndAdminUsers) {
          if (user.id === userId) continue;
          await this.create({
            type: event.type,
            title,
            description,
            user_id: user.id,
            entity_id: event.entity_id ?? null,
            entity_type: entityType,
            metadata: event.metadata ?? null,
            priority: (event.priority as any) ?? 'medium',
            status: 'unread',
            target_url: targetUrl,
          } as any);
        }
      }
      return;
    }

    // Șabloane (template): doar admin la creare, modificare, ștergere
    if (entityType === 'task_template' || ['template.created', 'template.updated', 'template.deleted'].includes(event.type)) {
      const targetUsers = await this.getUsersWithRoles(['admin']);
      const targetUrl = event.target_url ?? '/sarcini/new';
      for (const user of targetUsers) {
        await this.create({
          type: event.type,
          title: event.title,
          description: event.description,
          user_id: user.id,
          entity_id: event.entity_id ?? null,
          entity_type: entityType === 'task_template' ? entityType : 'task_template',
          metadata: event.metadata ?? null,
          priority: (event.priority as any) ?? 'medium',
          status: 'unread',
          target_url: targetUrl,
        } as any);
      }
      return;
    }

    this.logger.warn(
      `[tasks.notification] Skip: nici user_id nici assignedToId în metadata (type=${event.type}, entity_id=${event.entity_id})`,
    );
  }

  async onEmployeeNotification(event: { 
    type: string;
    title: string;
    description: string;
    entity_id?: number;
    entity_type: string;
    metadata?: any;
    priority: 'low' | 'medium' | 'high';
    target_url?: string;
  }) {
    if (event.entity_id) {
      const existing = await this.repo.findOne({ 
        where: { 
          entity_id: event.entity_id, 
          entity_type: event.entity_type, 
          type: event.type 
        } as any 
      });
      if (existing) return existing;
    }

    const isEmployeeCrud = ['employee_created', 'employee_updated', 'employee_deleted'].includes(event.type);
    const workLocationId = event.metadata?.work_location_id ?? null;
    let targetUsers: Array<{ id: number; email: string; roles: string[] }>;
    if (isEmployeeCrud) {
      targetUsers =
        workLocationId != null
          ? await this.getUsersWithAccessToLocation(['admin'], workLocationId)
          : await this.getUsersWithRoles(['admin']);
      if (targetUsers.length === 0 && workLocationId != null)
        targetUsers = await this.getUsersWithRoles(['admin']);
    } else {
      targetUsers = await this.getUsersWithRoles(['manager', 'admin']);
    }

    const { title, description } = await this.prefixWithLocation(
      event.title,
      event.description,
      workLocationId,
      event.metadata,
    );
    const notifications = [];
    for (const user of targetUsers) {
      const saved = await this.create({
        type: event.type,
        title,
        description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url ?? (event.entity_id ? `/angajati/${event.entity_id}` : undefined),
      } as any);
      notifications.push(saved);
    }
    return notifications;
  }

  /**
   * La aprobarea unei încasări de către manager: notificare pentru fiecare angajat pontat în ziua încasării,
   * cu suma câștigată de fiecare.
   */
  async onRevenueApproved(event: {
    revenueId: number;
    workLocationId: number;
    revenueDate: string;
    employees: Array<{ employeeId: number; amount: number }>;
  }) {
    const datePart = event.revenueDate?.toString().split('T')[0]?.split(' ')[0] || event.revenueDate || '—';
    const dateDisplay = datePart; // ex. 2025-03-06
    const notifications = [];
    const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';

    for (const { employeeId, amount } of event.employees) {
      let userId: number | null = null;
      try {
        const res = await firstValueFrom(
          this.httpService.get(`${apiGatewayUrl}/users/employee/${employeeId}`, {
            headers: {
              'x-internal-service': 'notifications',
              'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
            },
          })
        );
        const user = res.data?.data ?? res.data;
        if (user?.id) userId = user.id;
      } catch (e: any) {
        this.logger.warn(`[revenue_approved] Nu s-a putut rezolva user_id pentru employee ${employeeId}: ${e?.message || e}`);
        continue;
      }
      if (userId == null) continue;

      const amountFormatted = typeof amount === 'number' ? amount.toFixed(2) : String(amount);
      const title = 'Încasare acceptată';
      const description = `Încasarea pentru data ${dateDisplay} a fost acceptată. Suma ta pentru această zi: ${amountFormatted} RON.`;

      const existing = await this.repo.findOne({
        where: {
          entity_id: event.revenueId,
          entity_type: 'revenue',
          type: 'revenue_approved',
          user_id: userId,
        } as any,
      });
      if (existing) continue;

      const saved = await this.create({
        type: 'revenue_approved',
        title,
        description,
        user_id: userId,
        entity_id: event.revenueId,
        entity_type: 'revenue',
        metadata: { workLocationId: event.workLocationId, revenueDate: datePart, amount, employeeId },
        priority: 'medium',
        status: 'unread',
        target_url: `/locatii/${event.workLocationId}`,
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
    const rawUserId = userId ?? currentUser?.userId;
    let resolvedUserId: number | null = rawUserId != null ? await this.userResolution.resolveToUserId(rawUserId) : null;
    const userIdsForQuery = [resolvedUserId, rawUserId].filter((id): id is number => id != null && id !== undefined);
    const uniqueUserIds = [...new Set(userIdsForQuery)];

    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Fiecare user (inclusiv admin/manager) vede doar notificările proprii (user_id = utilizatorul curent)
    // Notificările pot fi stocate cu user_id = users.id (rezolvat) sau = employee_id (raw) – căutăm pe ambele
    if (uniqueUserIds.length > 0) {
      return this.repo
        .createQueryBuilder('notification')
        .where('notification.user_id IN (:...userIds)', { userIds: uniqueUserIds })
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

        // Web Push: trimite și pe FCM ca să ajungă și când app-ul e închis
        try {
          const baseUrl = process.env.FRONTEND_BASE_URL || '';
          const targetUrl = saved.target_url ? `${baseUrl}${saved.target_url.startsWith('/') ? '' : '/'}${saved.target_url}` : '';
          await this.pushService.sendToUser(
            saved.user_id,
            {
              title: saved.title,
              body: saved.description ?? undefined,
              data: {
                notificationId: String(saved.id),
                type: saved.type,
                target_url: saved.target_url ?? '',
                url: targetUrl,
              },
            },
            saved.id,
          );
        } catch (pushErr: any) {
          this.logger.warn(`Web Push send failed: ${pushErr?.message || pushErr}`);
        }
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
    if (userId == null || userId === undefined) {
      return { message: 'User ID required' };
    }
    const resolvedUserId = await this.userResolution.resolveToUserId(userId);
    const userIds = [resolvedUserId, userId].filter((id, i, a) => id != null && a.indexOf(id) === i);
    const unreadCountBefore = await this.repo
      .createQueryBuilder('n')
      .where('n.status = :status', { status: 'unread' })
      .andWhere('n.user_id IN (:...userIds)', { userIds })
      .getCount();
    this.logger.log(`markAllAsRead: raw=${userId}, resolved=${resolvedUserId}, user_id IN (${userIds.join(',')}), unread in DB before update=${unreadCountBefore}`);
    const result = await this.repo.createQueryBuilder()
      .update(NotificationEntity)
      .set({ status: 'read' } as any)
      .where("status = 'unread' AND user_id IN (:...userIds)", { userIds })
      .execute();
    const affected = result.affected ?? 0;
    this.logger.log(`markAllAsRead: rows updated=${affected}`);
    const count = await this.repo
      .createQueryBuilder('n')
      .where('n.status = :status', { status: 'unread' })
      .andWhere('n.user_id IN (:...userIds)', { userIds })
      .getCount();
    this.gateway.emitUnreadCountForUser(resolvedUserId, count);
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

  // Cron job: verificare documente expirate/expirând – rulează la 6:00 și 18:00 (la zi)
  @Cron('0 0 6,18 * * *')
  async checkExpiringFiles() {
    this.logger.log('📋 [DOCUMENTE CRON] Start verificare documente expirate / expirând (angajati, firme, locatii, furnizori)');
    try {
      const managerAndAdminUsers = await this.getUsersWithRoles(['manager', 'admin']);
      if (managerAndAdminUsers.length === 0) {
        this.logger.warn('📋 [DOCUMENTE CRON] Niciun utilizator manager/admin găsit – nu se trimit notificări');
        return;
      }
      this.logger.log(`📋 [DOCUMENTE CRON] ${managerAndAdminUsers.length} manageri/admins vor primi notificări`);

      await this.checkFilesExpiringInDays(7, managerAndAdminUsers);
      await this.checkExpiredFiles(managerAndAdminUsers);

      this.logger.log('📋 [DOCUMENTE CRON] Verificare documente încheiată');
    } catch (error: any) {
      this.logger.error(`📋 [DOCUMENTE CRON] Eroare: ${error?.message || error}`, error?.stack);
    }
  }
  
  // Check for files expiring in a specific number of days
  private async checkFilesExpiringInDays(days: number, users: Array<{id: number, email: string, roles: string[]}>) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const targetDateString = targetDate.toISOString().split('T')[0];
    const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';

    try {
      await this.checkCompanyDocumentsExpiring(targetDateString, days, users, apiGatewayUrl);
      await this.checkLocationFilesExpiring(targetDateString, days, users, apiGatewayUrl);
      await this.checkEmployeeFilesExpiring(targetDateString, days, users, apiGatewayUrl);
      await this.checkSupplierDocumentsExpiring(targetDateString, days, users, apiGatewayUrl);
    } catch (error: any) {
      this.logger.warn(`[DOCUMENTE CRON] checkFilesExpiringInDays: ${error?.message || error}`);
    }
  }

  /** Returnează true dacă există deja o notificare expirat pentru acest entity în ultimele EXPIRED_DOC_DEDUPE_DAYS zile (pentru a nu duplica). */
  private async hasRecentExpiredNotification(entityId: number, entityType: string, type: string): Promise<boolean> {
    const since = new Date();
    since.setDate(since.getDate() - this.EXPIRED_DOC_DEDUPE_DAYS);
    const existing = await this.repo.findOne({
      where: {
        entity_id: entityId,
        entity_type: entityType,
        type,
        created_at: MoreThanOrEqual(since) as any,
      } as any,
    });
    return !!existing;
  }

  // Check for already expired files – trimite notificări manageri/admins
  private async checkExpiredFiles(users: Array<{id: number, email: string, roles: string[]}>) {
    const today = new Date().toISOString().split('T')[0];
    const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';

    try {
      await this.checkCompanyDocumentsExpired(today, users, apiGatewayUrl);
      await this.checkLocationFilesExpired(today, users, apiGatewayUrl);
      await this.checkEmployeeFilesExpired(today, users, apiGatewayUrl);
      await this.checkSupplierDocumentsExpired(today, users, apiGatewayUrl);
    } catch (error: any) {
      this.logger.warn(`[DOCUMENTE CRON] checkExpiredFiles: ${error?.message || error}`);
    }
  }
  
  // Check company documents expiring
  private async checkCompanyDocumentsExpiring(targetDate: string, days: number, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/companies/documents/expiring/${targetDate}`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      const documents = Array.isArray(response.data) ? response.data : [];
      
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
    } catch (error: any) {
      this.logger.warn(`[DOCUMENTE CRON] Firme (expiră în ${days} zile): ${error?.message || error}`);
    }
  }

  // Check location files expiring – notifică doar admin/manager de la acea locație
  private async checkLocationFilesExpiring(targetDate: string, days: number, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/locations/files/expiring/${targetDate}`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      const files = Array.isArray(response.data) ? response.data : [];
      for (const file of files) {
        const locationName = file.workLocation?.location_name || 'N/A';
        const workLocationId = file.work_location_id;
        let targetUsers =
          workLocationId != null
            ? await this.getUsersWithAccessToLocation(['manager', 'admin'], workLocationId)
            : [];
        if (targetUsers.length === 0) targetUsers = users;
        const rawTitle = `Document locatie expira in ${days} zile`;
        const rawDesc = `Documentul "${file.file_name}" al locatiei "${locationName}" va expira in ${days} zile`;
        const { title, description } = await this.prefixWithLocation(
          rawTitle,
          rawDesc,
          workLocationId,
          { location_name: locationName },
        );
        for (const user of targetUsers) {
          await this.create({
            type: 'location_file_expiring',
            title,
            description,
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
    } catch (error: any) {
      this.logger.warn(`[DOCUMENTE CRON] Locații (expiră în ${days} zile): ${error?.message || error}`);
    }
  }

  // Check employee files expiring
  private async checkEmployeeFilesExpiring(targetDate: string, days: number, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/employees/files/expiring/${targetDate}`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      const files = Array.isArray(response.data) ? response.data : [];
      
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
    } catch (error: any) {
      this.logger.warn(`[DOCUMENTE CRON] Angajați (expiră în ${days} zile): ${error?.message || error}`);
    }
  }

  // Check supplier documents expiring
  private async checkSupplierDocumentsExpiring(targetDate: string, days: number, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/suppliers/documents/expiring/${targetDate}`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      const documents = Array.isArray(response.data) ? response.data : [];
      
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
    } catch (error: any) {
      this.logger.warn(`[DOCUMENTE CRON] Furnizori (expiră în ${days} zile): ${error?.message || error}`);
    }
  }

  // Check company documents expired
  private async checkCompanyDocumentsExpired(today: string, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/companies/documents/expired`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      const documents = Array.isArray(response.data) ? response.data : [];
      this.logger.log(`[DOCUMENTE CRON] Firme: ${documents.length} documente expirate`);

      for (const document of documents) {
        const alreadyNotified = await this.hasRecentExpiredNotification(document.id, 'company_document', 'company_document_expired');
        if (alreadyNotified) continue;
        const companyName = document.company?.company_name || 'N/A';
        for (const user of users) {
          await this.create({
            type: 'company_document_expired',
            title: 'Document companie expirat',
            description: `Documentul "${document.document_name}" al companiei "${companyName}" a expirat`,
            user_id: user.id,
            entity_id: document.id,
            entity_type: 'company_document',
            metadata: { companyId: document.company_id, companyName, documentName: document.document_name, expireDate: document.expire_date },
            priority: 'high',
            status: 'unread',
            target_url: `/setari/documente?tab=firme`,
          } as any);
        }
      }
    } catch (error: any) {
      this.logger.warn(`[DOCUMENTE CRON] Firme (expirate): ${error?.message || error}`);
    }
  }
  
  // Check location files expired – notifică doar admin/manager de la acea locație
  private async checkLocationFilesExpired(today: string, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/locations/files/expired`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      const files = Array.isArray(response.data) ? response.data : [];
      this.logger.log(`[DOCUMENTE CRON] Locații: ${files.length} documente expirate`);

      for (const file of files) {
        const alreadyNotified = await this.hasRecentExpiredNotification(file.id, 'location_file', 'location_file_expired');
        if (alreadyNotified) continue;
        const locationName = file.workLocation?.location_name || 'N/A';
        const workLocationId = file.work_location_id;
        let targetUsers =
          workLocationId != null
            ? await this.getUsersWithAccessToLocation(['manager', 'admin'], workLocationId)
            : [];
        if (targetUsers.length === 0) targetUsers = users;
        const { title, description } = await this.prefixWithLocation(
          'Document locație expirat',
          `Documentul "${file.file_name}" al locației "${locationName}" a expirat`,
          workLocationId,
          { location_name: locationName },
        );
        for (const user of targetUsers) {
          await this.create({
            type: 'location_file_expired',
            title,
            description,
            user_id: user.id,
            entity_id: file.id,
            entity_type: 'location_file',
            metadata: { locationId: file.work_location_id, locationName, fileName: file.file_name, expireDate: file.expire_date },
            priority: 'high',
            status: 'unread',
            target_url: `/setari/documente?tab=locatii`,
          } as any);
        }
      }
    } catch (error: any) {
      this.logger.warn(`[DOCUMENTE CRON] Locații (expirate): ${error?.message || error}`);
    }
  }
  
  // Check employee files expired
  private async checkEmployeeFilesExpired(today: string, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/employees/files/expired`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      const files = Array.isArray(response.data) ? response.data : [];
      this.logger.log(`[DOCUMENTE CRON] Angajați: ${files.length} documente expirate`);

      for (const file of files) {
        const alreadyNotified = await this.hasRecentExpiredNotification(file.id, 'employee_file', 'employee_file_expired');
        if (alreadyNotified) continue;
        const employeeName = file.employee ? `${file.employee.first_name} ${file.employee.last_name}` : 'N/A';
        for (const user of users) {
          await this.create({
            type: 'employee_file_expired',
            title: 'Document angajat expirat',
            description: `Documentul "${file.file_name}" al angajatului "${employeeName}" a expirat`,
            user_id: user.id,
            entity_id: file.id,
            entity_type: 'employee_file',
            metadata: { employeeId: file.employee_id, employeeName, fileName: file.file_name, expireDate: file.expire_date },
            priority: 'high',
            status: 'unread',
            target_url: `/setari/documente?tab=angajati`,
          } as any);
        }
      }
    } catch (error: any) {
      this.logger.warn(`[DOCUMENTE CRON] Angajați (expirate): ${error?.message || error}`);
    }
  }
  
  // Check supplier documents expired
  private async checkSupplierDocumentsExpired(today: string, users: Array<{id: number, email: string, roles: string[]}>, apiGatewayUrl: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/suppliers/documents/expired`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      const documents = Array.isArray(response.data) ? response.data : [];
      this.logger.log(`[DOCUMENTE CRON] Furnizori: ${documents.length} documente expirate`);

      for (const document of documents) {
        const alreadyNotified = await this.hasRecentExpiredNotification(document.id, 'supplier_document', 'supplier_document_expired');
        if (alreadyNotified) continue;
        const supplierName = document.folder?.supplier?.supplier_name || 'N/A';
        for (const user of users) {
          await this.create({
            type: 'supplier_document_expired',
            title: 'Document furnizor expirat',
            description: `Documentul "${document.file_name}" al furnizorului "${supplierName}" a expirat`,
            user_id: user.id,
            entity_id: document.id,
            entity_type: 'supplier_document',
            metadata: { supplierId: document.folder?.supplier_id, supplierName, fileName: document.file_name, expireDate: document.expire_date },
            priority: 'high',
            status: 'unread',
            target_url: `/setari/documente?tab=furnizori`,
          } as any);
        }
      }
    } catch (error: any) {
      this.logger.warn(`[DOCUMENTE CRON] Furnizori (expirate): ${error?.message || error}`);
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

    const workLocationId = event.metadata?.work_location_id ?? null;
    const managerAndAdminUsers =
      workLocationId != null
        ? await this.getUsersWithAccessToLocation(['manager', 'admin'], workLocationId)
        : await this.getUsersWithRoles(['manager', 'admin']);

    const { title, description } = await this.prefixWithLocation(
      event.title,
      event.description,
      workLocationId,
      event.metadata,
    );
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      const saved = await this.create({
        type: event.type,
        title,
        description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url,
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

    const workLocationId = event.metadata?.work_location_id ?? null;
    const managerAndAdminUsers =
      workLocationId != null
        ? await this.getUsersWithAccessToLocation(['manager', 'admin'], workLocationId)
        : await this.getUsersWithRoles(['manager', 'admin']);

    const { title, description } = await this.prefixWithLocation(
      event.title,
      event.description,
      workLocationId,
      event.metadata,
    );
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      const saved = await this.create({
        type: event.type,
        title,
        description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url,
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
    
    const workLocationId = event.metadata?.work_location_id ?? null;
    const managerAndAdminUsers =
      workLocationId != null
        ? await this.getUsersWithAccessToLocation(['manager', 'admin'], workLocationId)
        : await this.getUsersWithRoles(['manager', 'admin']);

    const { title, description } = await this.prefixWithLocation(
      event.title,
      event.description,
      workLocationId,
      event.metadata,
    );
    const notifications = [];
    for (const user of managerAndAdminUsers) {
      const saved = await this.create({
        type: event.type,
        title,
        description,
        user_id: user.id,
        entity_id: event.entity_id,
        entity_type: event.entity_type,
        metadata: event.metadata,
        priority: event.priority,
        status: 'unread',
        target_url: event.target_url,
      } as any);
      notifications.push(saved);
    }

    return notifications;
  }
}
