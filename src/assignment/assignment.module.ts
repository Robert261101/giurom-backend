import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentService } from './assignment.service';
import { AssignmentController } from './assignment.controller';
import { TaskAssignment } from './entity/task-assignment.entity';
import { TaskAssignmentElement } from './entity/task-assignment-element.entity';
import { TaskTemplate } from '../template/entity/task-template.entity';
import { TaskElement } from '../template/entity/task-element.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskAssignment,
      TaskAssignmentElement,
      TaskTemplate,
      TaskElement
    ])
  ],
  controllers: [AssignmentController],
  providers: [AssignmentService],
  exports: [AssignmentService],
})
export class AssignmentModule {} 