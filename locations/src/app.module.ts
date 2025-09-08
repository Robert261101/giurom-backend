import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkLocation } from './locations/entity/work-location.entity';
import { WorkLocationTaskTemplate } from './locations/entity/work-location-task-template.entity';
import { WorkLocationDepartments } from './locations/entity/work-location-departments.entity';
import { WorkLocationDepartmentPositions } from './locations/entity/work-location-department-positions.entity';
import { WorkLocationRevenue } from './locations/entity/work-location-revenue.entity';
import { WorkLocationRevenuePoints } from './locations/entity/work-location-revenue-points.entity';
import { WorkLocationManagerConfig } from './locations/entity/work-location-manager-config.entity';
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
        WorkLocationTaskTemplate,
        WorkLocationDepartments,
        WorkLocationDepartmentPositions,
        WorkLocationRevenue,
        WorkLocationRevenuePoints,
        WorkLocationManagerConfig,
      ],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
      charset: 'utf8mb4',
      timezone: '+00:00',
    }),
    TypeOrmModule.forFeature([
      WorkLocation,
      WorkLocationTaskTemplate,
      WorkLocationDepartments,
      WorkLocationDepartmentPositions,
      WorkLocationRevenue,
      WorkLocationRevenuePoints,
      WorkLocationManagerConfig,
    ]),
  ],
  controllers: [LocationsMicroController, LocationsHttpController],
  providers: [LocationsService],
})
export class AppModule {}
