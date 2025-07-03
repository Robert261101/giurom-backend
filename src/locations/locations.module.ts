import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { WorkLocation } from './entity/work-location.entity';
import { WorkLocationTaskTemplate } from './entity/work-location-task-template.entity';
import { WorkLocationDepartments } from './entity/work-location-departments.entity';
import { WorkLocationDepartmentPositions } from './entity/work-location-department-positions.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkLocation, WorkLocationTaskTemplate, WorkLocationDepartments, WorkLocationDepartmentPositions])],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {} 