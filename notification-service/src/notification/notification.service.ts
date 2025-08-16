import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entity/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async createNotification(
    referenceId: number,
    type: NotificationType,
    payload?: any,
    resource?: string,
  ) {
    const exists = await this.repo.findOne({ where: { referenceId, type, read: false } });
    if (exists) return exists;
    const resourceFinal = resource ?? type.split('_')[0];
    const notif = this.repo.create({
      referenceId,
      resource: resourceFinal,
      type,
      payload,
      resolved: false,
    });
    const saved = await this.repo.save(notif);
    return saved;
  }

  async findAll(unreadOnly = false) {
    return this.repo.find({ where: unreadOnly ? { read: false } : {} });
  }

  async markAsRead(id: number) {
    await this.repo.update(id, { read: true });
  }
} 