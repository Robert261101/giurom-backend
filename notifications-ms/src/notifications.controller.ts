import { Controller, Get, Post, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';
import { Permissions } from './permissions/permissions.decorator';
import { PermissionsGuard } from './permissions/permissions.guard';

@Controller('notifications')
@UseGuards(PermissionsGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // HTTP endpoints for frontend
  @Get('unread-count')
  @Permissions('notifications.read')
  getUnreadCountHttp(@Request() req, @Query('userId') userId?: string) {
    // Use the userId from query params if provided, otherwise use the authenticated user's ID
    const targetUserId = userId ? parseInt(userId, 10) : req.user?.userId;
    return this.service.getUnreadCount(targetUserId);
  }

  // List notifications
  @Get()
  @Permissions('notifications.read')
  findAll(@Request() req, @Query('userId') userId?: string) {
    // Use the userId from query params if provided, otherwise use the authenticated user's ID
    const targetUserId = userId ? parseInt(userId, 10) : req.user?.userId;
    return this.service.findAll(targetUserId);
  }


  // Mark one as read
  @Patch(':id/read')
  @Permissions('notifications.update')
  markAsRead(@Param('id') id: string) {
    return this.service.markAsRead(Number(id));
  }

  // Mark all as read
  @Patch('mark-all-read')
  @Permissions('notifications.update')
  markAllAsRead(@Request() req, @Query('userId') userId?: string) {
    // Use the userId from query params if provided, otherwise use the authenticated user's ID
    const targetUserId = userId ? parseInt(userId, 10) : req.user?.userId;
    return this.service.markAllAsRead(targetUserId);
  }

  // Trigger expiring labels check (demo/seed)
  @Post('check-expiring-labels')
  @Permissions('notifications.create')
  checkExpiringLabels() {
    return this.service.seedExpiringLabel();
  }

  // Trigger file expiration check
  @Post('trigger-file-expiration-check')
  @Permissions('notifications.create')
  async triggerFileExpirationCheck() {
    await this.service.checkExpiringFiles();
    return { message: 'File expiration check triggered successfully' };
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
    console.log(`📥 [NOTIFICATIONS CONTROLLER] Received supplier notification message:`, JSON.stringify(data, null, 2));
    await this.service.onSupplierNotification(data);
    console.log(`✅ [NOTIFICATIONS CONTROLLER] Supplier notification processed successfully`);
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
    console.log(`📥 [NOTIFICATIONS CONTROLLER] Received location notification message:`, data);
    await this.service.onLocationNotification(data);
    console.log(`✅ [NOTIFICATIONS CONTROLLER] Location notification processed successfully`);
    return true;
  }

  @MessagePattern({ cmd: 'leave.notification' })
  async handleLeaveNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onLeaveNotification(data);
    return true;
  }

  @MessagePattern({ cmd: 'shift-change.notification' })
  async handleShiftChangeNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onShiftChangeNotification(data);
    return true;
  }

  @MessagePattern({ cmd: 'shift.notification' })
  async handleShiftNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onShiftNotification(data);
    return true;
  }

  @MessagePattern({ cmd: 'attendance.notification' })
  async handleAttendanceNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onAttendanceNotification(data);
    return true;
  }

  @MessagePattern({ cmd: 'employees.notification' })
  async handleEmployeeNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onEmployeeNotification(data);
    return true;
  }

  @MessagePattern({ cmd: 'calendar.notification' })
  async handleCalendarNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onCalendarNotification(data);
    return true;
  }

  @MessagePattern({ cmd: 'waste-records.notification' })
  async handleWasteRecordsNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onWasteRecordsNotification(data);
    return true;
  }

  @MessagePattern({ cmd: 'company.notification' })
  async handleCompanyNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    console.log(`📥 [NOTIFICATIONS CONTROLLER] Received company notification message:`, JSON.stringify(data, null, 2));
    await this.service.onCompanyNotification(data);
    console.log(`✅ [NOTIFICATIONS CONTROLLER] Company notification processed successfully`);
    return true;
  }

  @MessagePattern({ cmd: 'notifications.health' })
  health() {
    return { ok: true };
  }
}