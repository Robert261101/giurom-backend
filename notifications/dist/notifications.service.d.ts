import { Repository } from 'typeorm';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationEntity } from './notification.entity';
export declare class NotificationsService {
    private readonly gateway;
    private readonly repo;
    constructor(gateway: NotificationsGateway, repo: Repository<NotificationEntity>);
    private notifications;
    private nextId;
    getUnreadCount(): Promise<{
        count: number;
    }>;
    onExpiringLabel(event: {
        labelId: number;
        labelCode: string;
        preparationId: number;
        expiresAt: string;
    }): Promise<NotificationEntity | NotificationEntity[]>;
    findAll(): Promise<NotificationEntity[]>;
    create(notification: Partial<NotificationEntity>): Promise<NotificationEntity[]>;
    markAsRead(id: number): Promise<{
        id: number;
    }>;
    markAllAsRead(): Promise<{
        message: string;
    }>;
    seedExpiringLabel(): Promise<NotificationEntity[]>;
}
