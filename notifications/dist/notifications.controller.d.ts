import { RmqContext } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly service;
    constructor(service: NotificationsService);
    getUnreadCountHttp(): Promise<{
        count: number;
    }>;
    findAll(_userId?: string): Promise<import("./notification.entity").NotificationEntity[]>;
    markAsRead(id: string): Promise<{
        id: number;
    }>;
    markAllAsRead(): Promise<{
        message: string;
    }>;
    checkExpiringLabels(): Promise<import("./notification.entity").NotificationEntity[]>;
    healthHttp(): {
        status: string;
        service: string;
        timestamp: string;
    };
    getUnreadCount(): Promise<{
        count: number;
    }>;
    handleExpiringLabel(data: any, _ctx: RmqContext): Promise<boolean>;
    health(): {
        ok: boolean;
    };
}
