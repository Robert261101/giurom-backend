import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { TaskExecution } from './entity/task-execution.entity';
import { TaskExecutionAnswer } from './entity/task-execution-answer.entity';
import { EmployeeDailyPoints } from './entity/employee-daily-points.entity';
import { EmployeeDailyTaskPoints } from './entity/employee-daily-task-points.entity';
import { ManagerDailyPayout } from './entity/manager-daily-payout.entity';
import { TaskAssignment } from '../assignment/entity/task-assignment.entity';
import { TaskElement } from '../template/entity/task-element.entity';
import { AssignmentExistsValidator } from './validators/assignment-exists.validator';
import { ElementsExistInTemplateValidator } from './validators/elements-exist-in-template.validator';
import { EmployeeAccessModule } from '../employee-access/employee-access.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskExecution,
      TaskExecutionAnswer,
      EmployeeDailyPoints,
      EmployeeDailyTaskPoints,
      ManagerDailyPayout,
      TaskAssignment,
      TaskElement
    ]),
    NotificationsModule,
    EmployeeAccessModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '59m'},
    }),
    HttpModule
  ],
  controllers: [ExecutionController],
  providers: [
    ExecutionService,
    AssignmentExistsValidator,
    ElementsExistInTemplateValidator
  ],
  exports: [ExecutionService],
})
export class ExecutionModule {} 