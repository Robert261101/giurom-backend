import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { WorkLocation } from './entity/work-location.entity';
import { WorkLocationTaskTemplate } from './entity/work-location-task-template.entity';
import { WorkLocationDepartments } from './entity/work-location-departments.entity';
import { WorkLocationDepartmentPositions } from './entity/work-location-department-positions.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkLocation, WorkLocationTaskTemplate]),
    ClientsModule.register([
      {
        name: 'LOCATIONS_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.LOCATIONS_MS_HOST || '127.0.0.1',
          port: parseInt(process.env.LOCATIONS_MS_PORT || '4003', 10),
        },
      },
    ]),
  ],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {} 