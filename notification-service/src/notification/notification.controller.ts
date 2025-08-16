import { Controller, Get, Query, Patch, Param, Post, Body, Req, Logger, HttpStatus } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationType } from './entity/notification.entity';
import { HttpService } from '@nestjs/axios';
import { Request } from 'express';
import { logAction } from '../common/logging.util';
import { CreateNotificationDto } from './dto/create-notification.dto';

function apiResponse(data: any, message?: string, statusCode: number = 200) {
  return {
    statusCode,
    data,
    message
  };
}

@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly httpService: HttpService
  ) {}

  @Post()
  async create(
    @Body() body: CreateNotificationDto,
    @Req() req: Request
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'] as string;
    try {
      const result = await this.notificationService.createNotification(
        body.referenceId,
        body.type,
        body.payload,
        body.resource,
      );
      await logAction(
        this.httpService,
        this.logger,
        'create',
        'success',
        0,
        'notification',
        result.id,
        body.payload,
        undefined,
        ip,
        userAgent
      );
      return apiResponse(result, 'Notificare creată cu succes', HttpStatus.CREATED);
    } catch (e) {
      await logAction(
        this.httpService,
        this.logger,
        'create',
        'failure',
        0,
        'notification',
        0,
        { ...body, error: e.message },
        undefined,
        ip,
        userAgent
      );
      throw e;
    }
  }

  @Get()
  async findAll(@Query('unread') unread?: string) {
    const unreadOnly = unread === 'true';
    const result = await this.notificationService.findAll(unreadOnly);
    return apiResponse(result);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    await this.notificationService.markAsRead(Number(id));
    return apiResponse({ id }, 'Notificare marcată ca citită');
  }
} 