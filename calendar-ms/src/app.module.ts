import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from '@/calendar/entities/calendar-event.entity';
import { RecurrenceRule } from '@/calendar/entities/recurrence-rule.entity';
import { Employee } from '@/employee/entity/employee.entity';
import { EmployeeWorkLocationHistory } from '@/employee/entity/employee-work-location-history.entity';
import { EmployeeFiles } from '@/employee/entity/employee-files.entity';
import { GeneratedDocuments } from '@/employee/entity/generated-documents.entity';
import { CalendarService } from '@/calendar/calendar.service';
import { CalendarMicroController } from './calendar.micro.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['calendar-ms/.env', '.env'] }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_DATABASE || 'giurom_db',
      entities: [
        CalendarEvent,
        RecurrenceRule,
        Employee,
        EmployeeWorkLocationHistory,
        EmployeeFiles,
        GeneratedDocuments,
      ],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      charset: 'utf8mb4',
      timezone: '+00:00',
      extra: {
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: 'utf8mb4',
        initStatements: [
          "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
          'SET CHARACTER SET utf8mb4',
          'SET character_set_connection=utf8mb4',
        ],
      },
    }),
    TypeOrmModule.forFeature([
      CalendarEvent,
      RecurrenceRule,
      Employee,
      EmployeeWorkLocationHistory,
      EmployeeFiles,
      GeneratedDocuments,
    ]),
  ],
  controllers: [CalendarMicroController],
  providers: [CalendarService],
})
export class AppModule {}


