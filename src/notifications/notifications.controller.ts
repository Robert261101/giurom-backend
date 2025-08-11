import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from './entities/notification.entity';

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Creează o notificare nouă' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Notificarea a fost creată cu succes',
    type: Notification,
  })
  create(@Body() createNotificationDto: CreateNotificationDto): Promise<Notification> {
    return this.notificationsService.create(createNotificationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obține toate notificările' })
  @ApiQuery({ name: 'userId', required: false, description: 'ID-ul utilizatorului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista notificărilor',
    type: [Notification],
  })
  findAll(@Query('userId') userId?: string): Promise<Notification[]> {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.notificationsService.findAllForUser(userIdNum);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Obține numărul de notificări necitite' })
  @ApiQuery({ name: 'userId', required: false, description: 'ID-ul utilizatorului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Numărul de notificări necitite',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number', example: 5 }
      }
    }
  })
  async getUnreadCount(@Query('userId') userId?: string): Promise<{ count: number }> {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    const count = await this.notificationsService.getUnreadCount(userIdNum);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marchează o notificare ca citită' })
  @ApiParam({ name: 'id', description: 'ID-ul notificării' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notificarea a fost marcată ca citită',
    type: Notification,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notificarea nu a fost găsită',
  })
  markAsRead(@Param('id', ParseIntPipe) id: number): Promise<Notification> {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Marchează toate notificările ca citite' })
  @ApiQuery({ name: 'userId', required: false, description: 'ID-ul utilizatorului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Toate notificările au fost marcate ca citite',
  })
  async markAllAsRead(@Query('userId') userId?: string): Promise<{ message: string }> {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    await this.notificationsService.markAllAsRead(userIdNum);
    return { message: 'All notifications marked as read' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Șterge o notificare' })
  @ApiParam({ name: 'id', description: 'ID-ul notificării' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Notificarea a fost ștearsă',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notificarea nu a fost găsită',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.notificationsService.remove(id);
  }

  @Post('test-label-expiration')
  @ApiOperation({ summary: 'Testează crearea unei notificări de expirare label' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Notificarea de test a fost creată',
    type: Notification,
  })
  async testLabelExpiration(): Promise<Notification> {
    // Create a test notification for a label expiring in 2 hours
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 2);

    return this.notificationsService.createLabelExpirationNotification(
      999, // Mock label ID
      'Pizza Margherita Test',
      expirationDate,
      'LBL-TEST-001',
      1 // Mock user ID
    );
  }

  @Post('check-expiring-labels')
  @ApiOperation({ summary: 'Forțează verificarea label-urilor care expiră (pentru testare)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verificarea a fost executată',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Label expiration check completed' }
      }
    }
  })
  async checkExpiringLabels(): Promise<{ message: string }> {
    await this.notificationsService.checkExpiringLabels();
    return { message: 'Label expiration check completed' };
  }

  @Get('debug-labels')
  @ApiOperation({ summary: 'Debug - afișează toate label-urile și calculele de expirare' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Informații debug despre label-uri',
  })
  async debugLabels(): Promise<any> {
    return this.notificationsService.debugLabels();
  }
}