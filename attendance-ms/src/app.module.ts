import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from '@/attendance/entities/shift.entity';
import { Presence } from '@/attendance/entities/presence.entity';
import { PresenceInflexion } from '@/attendance/entities/presence-inflexion.entity';
import { Employee } from '@/employee/entity/employee.entity';
import { EmployeeWorkLocationHistory } from '@/employee/entity/employee-work-location-history.entity';
import { EmployeeFiles } from '@/employee/entity/employee-files.entity';
import { GeneratedDocuments } from '@/employee/entity/generated-documents.entity';
import { WorkLocation } from '@/locations/entity/work-location.entity';
import { WorkLocationDepartments } from '@/locations/entity/work-location-departments.entity';
import { WorkLocationDepartmentPositions } from '@/locations/entity/work-location-department-positions.entity';
import { WorkLocationTaskTemplate } from '@/locations/entity/work-location-task-template.entity';
import { Company } from '@/company/entity/company.entity';
import { CompanyDocument } from '@/company/entity/company-document.entity';
import { AttendanceService } from '@/attendance/attendance.service';
import { AttendanceMicroController } from './attendance.micro.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['attendance-ms/.env', '.env'] }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_DATABASE || 'giurom_db',
      entities: [
        Shift,
        Presence,
        PresenceInflexion,
        Employee,
        EmployeeWorkLocationHistory,
        EmployeeFiles,
        GeneratedDocuments,
        WorkLocation,
        WorkLocationDepartments,
        WorkLocationDepartmentPositions,
        WorkLocationTaskTemplate,
        Company,
        CompanyDocument,
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
      Shift,
      Presence,
      PresenceInflexion,
      Employee,
      EmployeeWorkLocationHistory,
      EmployeeFiles,
      GeneratedDocuments,
      WorkLocation,
      WorkLocationDepartments,
      WorkLocationDepartmentPositions,
      WorkLocationTaskTemplate,
      Company,
      CompanyDocument,
    ]),
  ],
  controllers: [AttendanceMicroController],
  providers: [AttendanceService],
})
export class AppModule {}


