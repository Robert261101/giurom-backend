import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { WorkLocation } from './entity/work-location.entity';
import { WorkLocationTaskTemplate } from './entity/work-location-task-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkLocation, WorkLocationTaskTemplate])],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {} 