import { Controller, Get, Post, Patch, Param, Query } from '@nestjs/common';
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

  // List notifications
  @Get()
  findAll(@Query('userId') _userId?: string) {
    // userId is currently ignored in this minimal implementation
    return this.service.findAll();
  }

  // Mark one as read
  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.service.markAsRead(Number(id));
  }

  // Mark all as read
  @Patch('mark-all-read')
  markAllAsRead() {
    return this.service.markAllAsRead();
  }

  // Trigger expiring labels check (demo/seed)
  @Post('check-expiring-labels')
  checkExpiringLabels() {
    return this.service.seedExpiringLabel();
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

  @MessagePattern({ cmd: 'suppliers.notification' })
  async handleSupplierNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onSupplierNotification(data);
    return true;
  }

  @MessagePattern({ cmd: 'recipes.notification' })
  async handleRecipeNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onRecipeNotification(data);
    return true;
  }

  @MessagePattern({ cmd: 'stock.notification' })
  async handleStockNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onStockNotification(data);
    return true;
  }

  @MessagePattern({ cmd: 'locations.notification' })
  async handleLocationNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onLocationNotification(data);
    return true;
  }

  @MessagePattern({ cmd: 'notifications.health' })
  health() {
    return { ok: true };
  }
}