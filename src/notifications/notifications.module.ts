import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { RecipeLabel } from '../recipe-labels/entities/recipe-label.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, RecipeLabel]),
    ScheduleModule.forRoot(), // Enable cron jobs
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService], // Export service so other modules can use it
})
export class NotificationsModule {}