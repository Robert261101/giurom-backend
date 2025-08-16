import { Controller, Get } from '@nestjs/common';
import { Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // HTTP endpoints for frontend
  @Get('unread-count')
  getUnreadCountHttp() {
    return this.service.getUnreadCount();
  }

  @Get('health')
  healthHttp() {
    return { status: 'ok', service: 'notifications-ms', timestamp: new Date().toISOString() };
  }

  // RabbitMQ message patterns for inter-service communication
  @MessagePattern({ cmd: 'notifications.unread-count' })
  getUnreadCount() {
    return this.service.getUnreadCount();
  }

  @MessagePattern({ cmd: 'labels.expiring-soon' })
  async handleExpiringLabel(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onExpiringLabel(data);
    return true;
  }

  @MessagePattern({ cmd: 'notifications.health' })
  health() {
    return { ok: true };
  }
}


