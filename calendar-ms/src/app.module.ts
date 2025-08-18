import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { RecurrenceRule } from './entities/recurrence-rule.entity';
import { Employee } from './entities/employee.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { CalendarMicroController } from './calendar.micro.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true, 
      envFilePath: ['.env'] 
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_DATABASE || 'giurom_db',
      entities: [
        CalendarEvent,
        RecurrenceRule,
        Employee,
      ],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      charset: 'utf8mb4',
    }),
    TypeOrmModule.forFeature([CalendarEvent, RecurrenceRule, Employee]),
  ],
  controllers: [CalendarController, CalendarMicroController],
  providers: [CalendarService],
  exports: [CalendarService, TypeOrmModule],
})
export class AppModule {}