import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { TaskTemplate } from './entity/task-template.entity';
import { TaskElement } from './entity/task-element.entity';
import { TemplatesLocations, WorkLocation } from './entity/templates-locations.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TaskTemplate, TaskElement, TemplatesLocations, WorkLocation])],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
