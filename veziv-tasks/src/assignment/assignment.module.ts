import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { NotificationsModule } from '../notifications/notifications.module';
import { AssignmentService } from './assignment.service';
import { AssignmentController } from './assignment.controller';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { TaskAssignment } from './entity/task-assignment.entity';
import { TaskAssignmentElement } from './entity/task-assignment-element.entity';
import { TaskTemplate } from '../template/entity/task-template.entity';
import { TaskElement } from '../template/entity/task-element.entity';
import { TaskExecution } from '../execution/entity/task-execution.entity';
import { ExecutionModule } from '../execution/execution.module';
import { TaskGateway } from '../websocket/task.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskAssignment,
      TaskAssignmentElement,
      TaskTemplate,
      TaskElement,
      TaskExecution,
    ]),
    HttpModule,
    NotificationsModule,
    ExecutionModule,
    JwtModule.register({
      secret: 'your-secret-key',
      signOptions: { expiresIn: '24h'},
    })
  ],
  controllers: [AssignmentController],
  providers: [AssignmentService, ScheduledTasksService, TaskGateway],
  exports: [AssignmentService, ScheduledTasksService],
})
export class AssignmentModule {} 