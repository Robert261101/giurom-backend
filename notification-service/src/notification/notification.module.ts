import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entity/notification.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationEventController } from './notification-event.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), HttpModule],
  providers: [NotificationService],
  controllers: [NotificationController, NotificationEventController],
})
export class NotificationModule {} 