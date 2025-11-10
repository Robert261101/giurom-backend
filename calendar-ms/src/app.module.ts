import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { RecurrenceRule } from './entities/recurrence-rule.entity';
import { ShiftChangeRequests } from './entities/shift-change-requests.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { EventCategory } from './entities/event-category.entity';
import { CalendarService } from './calendar.service';
import { EventCategoryService } from './event-category.service';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './permissions/permissions.guard';
import { CalendarController } from './calendar.controller';
import { EventCategoryController } from './event-category.controller';
import { CalendarMicroController } from './calendar.micro.controller';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(__dirname, '..', '.env')] }),
    ClientsModule.register([
      {
        name: 'NOTIFICATIONS_RMQ',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
          queueOptions: { durable: false },
        },
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST as string,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE as string,
      entities: [
        CalendarEvent,
        RecurrenceRule,
        ShiftChangeRequests,
        LeaveRequest,
        EventCategory,
      ],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
      charset: 'utf8mb4',
    }),
    TypeOrmModule.forFeature([CalendarEvent, RecurrenceRule, ShiftChangeRequests, LeaveRequest, EventCategory]),
  ],
  controllers: [CalendarController, EventCategoryController, CalendarMicroController],
  providers: [
    CalendarService,
    EventCategoryService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [CalendarService, EventCategoryService, TypeOrmModule],
})
export class AppModule {}