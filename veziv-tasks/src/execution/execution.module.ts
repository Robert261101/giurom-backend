import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { TaskExecution } from './entity/task-execution.entity';
import { TaskExecutionAnswer } from './entity/task-execution-answer.entity';
import { EmployeeDailyPoints } from './entity/employee-daily-points.entity';
import { EmployeeDailyTaskPoints } from './entity/employee-daily-task-points.entity';
import { TaskAssignment } from '../assignment/entity/task-assignment.entity';
import { TaskElement } from '../template/entity/task-element.entity';
import { AssignmentExistsValidator } from './validators/assignment-exists.validator';
import { ElementsExistInTemplateValidator } from './validators/elements-exist-in-template.validator';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskExecution,
      TaskExecutionAnswer,
      EmployeeDailyPoints,
      EmployeeDailyTaskPoints,
      TaskAssignment,
      TaskElement
    ]),
    ClientsModule.register([
      {
        name: 'NOTIFICATIONS_RMQ',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
          queueOptions: { durable: false },
        },
      },
    ]),
    JwtModule.register({
      secret: 'your-secret-key',
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