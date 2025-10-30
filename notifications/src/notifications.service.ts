import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationEntity } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly gateway: NotificationsGateway,
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


