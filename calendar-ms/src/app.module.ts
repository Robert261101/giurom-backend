import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { RecurrenceRule } from './entities/recurrence-rule.entity';
import { Employee } from './entities/employee.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { CalendarMicroController } from './calendar.micro.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(__dirname, '..', '.env')] }),
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
        Employee,
      ],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
      charset: 'utf8mb4',
    }),
    TypeOrmModule.forFeature([CalendarEvent, RecurrenceRule, Employee]),
  ],
  controllers: [CalendarController, CalendarMicroController],
  providers: [CalendarService],
  exports: [CalendarService, TypeOrmModule],
})
export class AppModule {}