import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Logger,
} from "@nestjs/common";
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
} from "@nestjs/microservices";
import { NotificationsService } from "./notifications.service";
import { PushService } from "./push/push.service";
import { Permissions } from "./permissions/permissions.decorator";
import { PermissionsGuard } from "./permissions/permissions.guard";
import { UserResolutionService } from "./user-resolution.service";

@Controller("notifications")
@UseGuards(PermissionsGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly service: NotificationsService,
    private readonly pushService: PushService,
    private readonly userResolution: UserResolutionService,
  ) {}

  // HTTP endpoints for frontend
  @Get("unread-count")
  @Permissions("notifications.read")
  getUnreadCountHttp(@Request() req, @Query("userId") userId?: string) {
    // Use the userId from query params if provided, otherwise use the authenticated user's ID
    const targetUserId = userId ? parseInt(userId, 10) : req.user?.userId;
    return this.service.getUnreadCount(targetUserId);
  }

  // List notifications
  @Get()
  @Permissions("notifications.read")
  findAll(@Request() req, @Query("userId") userId?: string) {
    // Use the userId from query params if provided, otherwise use the authenticated user's ID
    const targetUserId = userId ? parseInt(userId, 10) : req.user?.userId;
    return this.service.findAll(targetUserId);
  }

  // Mark all as read – trebuie înainte de :id/read ca „mark-all-read” să nu fie interpretat ca id
  @Patch("mark-all-read")
  @Permissions("notifications.update")
  markAllAsRead(@Request() req, @Query("userId") userId?: string) {
    const raw = userId
      ? parseInt(userId, 10)
      : (req.user?.userId ?? req.user?.sub);
    const targetUserId = Number.isNaN(raw) ? undefined : raw;
    this.logger.log(
      `mark-all-read apelat, targetUserId=${targetUserId}, query userId=${userId ?? "nu"}`,
    );
    return this.service.markAllAsRead(targetUserId);
  }

  // Mark one as read
  @Patch(":id/read")
  @Permissions("notifications.update")
  markAsRead(@Param("id") id: string) {
    return this.service.markAsRead(Number(id));
  }

  // Trigger expiring labels check (demo/seed)
  @Post("check-expiring-labels")
  @Permissions("notifications.create")
  checkExpiringLabels() {
    return this.service.seedExpiringLabel();
  }

  // Trigger file expiration check
  @Post("trigger-file-expiration-check")
  @Permissions("notifications.create")
  async triggerFileExpirationCheck() {
    await this.service.checkExpiringFiles();
    return { message: "File expiration check triggered successfully" };
  }

  /** Verifică dacă tokenul curent (sau utilizatorul) are abonament push înregistrat. */
  @Post("push-status")
  @Permissions("notifications.read")
  async pushStatus(
    @Request() req,
    @Body() body: { token?: string },
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      return { hasSubscription: false };
    }
    const resolvedUserId = await this.userResolution.resolveToUserId(userId);
    const hasSubscription = await this.pushService.hasSubscription(
      resolvedUserId,
      body?.token?.trim(),
    );
    return { hasSubscription };
  }

  /** Înregistrează token FCM pentru Web Push (notificări când app-ul e închis). Un singur device per user. */
  @Post("push-subscribe")
  @Permissions("notifications.read")
  async pushSubscribe(
    @Request() req,
    @Body() body: { token: string; deviceLabel?: string },
  ) {
    try {
      const userId = req.user?.userId;
      if (!userId || !body?.token) {
        return { success: false, message: "Missing userId or token" };
      }
      const resolvedUserId = await this.userResolution.resolveToUserId(userId);
      await this.pushService.subscribe(
        resolvedUserId,
        body.token.trim(),
        body.deviceLabel,
      );
      return { success: true };
    } catch (err: any) {
      this.logger.error(`push-subscribe: ${err?.message || err}`, err?.stack);
      // Return 200 cu success: false ca frontend-ul să nu afișeze eroare; cauza se vede în logs
      return {
        success: false,
        message:
          "Nu s-a putut înregistra notificările push. Încearcă din nou mai târziu.",
      };
    }
  }

  /** Trimite o notificare de test către user-ul curent (DB + WebSocket + Web Push). Pentru testare. */
  @Post("test-push")
  @Permissions("notifications.read")
  async sendTestPush(@Request() req) {
    const userId = req.user?.userId;
    if (!userId) {
      return { success: false, message: "Nu ești autentificat." };
    }
    const resolvedUserId = await this.userResolution.resolveToUserId(userId);
    await this.service.create({
      type: "test_push",
      title: "Test notificare push",
      description: "Dacă vezi asta, Web Push funcționează.",
      user_id: resolvedUserId,
      status: "unread",
      priority: "medium",
      target_url: "/notificari",
    } as any);
    return {
      success: true,
      message:
        "Notificare de test trimisă. Verifică notificările în app și push-ul pe dispozitiv.",
    };
  }

  /** Elimină token FCM (dezabonare Web Push). */
  @Post("push-unsubscribe")
  @Permissions("notifications.read")
  async pushUnsubscribe(@Request() req, @Body() body: { token: string }) {
    const userId = req.user?.userId;
    if (!userId || !body?.token) {
      return { success: false, message: "Missing userId or token" };
    }
    const resolvedUserId = await this.userResolution.resolveToUserId(userId);
    await this.pushService.unsubscribe(resolvedUserId, body.token.trim());
    return { success: true };
  }

  @Get("health")
  healthHttp() {
    return {
      status: "ok",
      service: "notifications-ms",
      timestamp: new Date().toISOString(),
    };
  }

  // RabbitMQ message patterns for inter-service communication
  @MessagePattern({ cmd: "notifications.unread-count" })
  getUnreadCount() {
    return this.service.getUnreadCount();
  }

  @MessagePattern({ cmd: "labels.expiring-soon" })
  async handleExpiringLabel(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onExpiringLabel(data);
    return true;
  }

  @MessagePattern({ cmd: "labels.expired" })
  async handleLabelExpired(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onLabelExpired(data);
    return true;
  }

  @MessagePattern({ cmd: "suppliers.notification" })
  async handleSupplierNotification(
    @Payload() data: any,
    @Ctx() _ctx: RmqContext,
  ) {
    await this.service.onSupplierNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "orders.notification" })
  async handleOrderNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onOrderNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "recipes.notification" })
  async handleRecipeNotification(
    @Payload() data: any,
    @Ctx() _ctx: RmqContext,
  ) {
    await this.service.onRecipeNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "stock.notification" })
  async handleStockNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onStockNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "locations.notification" })
  async handleLocationNotification(
    @Payload() data: any,
    @Ctx() _ctx: RmqContext,
  ) {
    await this.service.onLocationNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "locations.revenue_approved" })
  async handleRevenueApproved(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onRevenueApproved(data);
    return true;
  }

  @MessagePattern({ cmd: "leave.notification" })
  async handleLeaveNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onLeaveNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "shift-change.notification" })
  async handleShiftChangeNotification(
    @Payload() data: any,
    @Ctx() _ctx: RmqContext,
  ) {
    await this.service.onShiftChangeNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "shift.notification" })
  async handleShiftNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onShiftNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "attendance.notification" })
  async handleAttendanceNotification(
    @Payload() data: any,
    @Ctx() _ctx: RmqContext,
  ) {
    await this.service.onAttendanceNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "employees.notification" })
  async handleEmployeeNotification(
    @Payload() data: any,
    @Ctx() _ctx: RmqContext,
  ) {
    await this.service.onEmployeeNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "calendar.notification" })
  async handleCalendarNotification(
    @Payload() data: any,
    @Ctx() _ctx: RmqContext,
  ) {
    await this.service.onCalendarNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "waste-records.notification" })
  async handleWasteRecordsNotification(
    @Payload() data: any,
    @Ctx() _ctx: RmqContext,
  ) {
    await this.service.onWasteRecordsNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "company.notification" })
  async handleCompanyNotification(
    @Payload() data: any,
    @Ctx() _ctx: RmqContext,
  ) {
    await this.service.onCompanyNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "tasks.notification" })
  async handleTaskNotification(@Payload() data: any, @Ctx() _ctx: RmqContext) {
    await this.service.onTaskNotification(data);
    return true;
  }

  @MessagePattern({ cmd: "notifications.health" })
  health() {
    return { ok: true };
  }
}
