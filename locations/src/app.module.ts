import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkLocation } from './locations/entity/work-location.entity';
import { CompanyRef } from './locations/entity/company-ref.entity';
import { WorkLocationTaskTemplate } from './locations/entity/work-location-task-template.entity';
import { WorkLocationDepartments } from './locations/entity/work-location-departments.entity';
import { WorkLocationDepartmentPositions } from './locations/entity/work-location-department-positions.entity';
import { LocationsService } from './locations/locations.service';
import { LocationsMicroController } from './locations.micro.controller';
import { LocationsHttpController } from './locations.http.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(__dirname, '..', '.env')] }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST as string,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE as string,
      entities: [
        WorkLocation,
        CompanyRef,
        WorkLocationTaskTemplate,
        WorkLocationDepartments,
        WorkLocationDepartmentPositions,
      ],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
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
      WorkLocation,
      CompanyRef,
      WorkLocationTaskTemplate,
      WorkLocationDepartments,
      WorkLocationDepartmentPositions,
    ]),
  ],
  controllers: [LocationsMicroController, LocationsHttpController],
  providers: [LocationsService],
})
export class AppModule {}
