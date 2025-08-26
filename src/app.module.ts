import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { TemplateModule } from './template/template.module';
import { ExecutionModule } from './execution/execution.module';
import { AssignmentModule } from './assignment/assignment.module';
import { TaskTemplate } from './template/entity/task-template.entity';
import { TaskElement } from './template/entity/task-element.entity';
import { TaskExecution } from './execution/entity/task-execution.entity';
import { TaskExecutionAnswer } from './execution/entity/task-execution-answer.entity';
import { EmployeeDailyPoints } from './execution/entity/employee-daily-points.entity';
import { EmployeeDailyTaskPoints } from './execution/entity/employee-daily-task-points.entity';
import { TaskAssignment } from './assignment/entity/task-assignment.entity';
import { TaskAssignmentElement } from './assignment/entity/task-assignment-element.entity';
import { TemplateExistsValidator } from './assignment/validators/template-exists.validator';
import { ElementsExistInTemplateValidator } from './assignment/validators/elements-exist-in-template.validator';
import { AllElementsCompletedValidator } from './assignment/validators/all-elements-completed.validator';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_DATABASE || 'giurom_db',
      entities: [
        TaskTemplate,
        TaskElement,
        TaskExecution,
        TaskExecutionAnswer,
        EmployeeDailyPoints,
        EmployeeDailyTaskPoints,
        TaskAssignment,
        TaskAssignmentElement
      ],
      synchronize: false,
      // dropSchema: true, 
    }),
    TypeOrmModule.forFeature([
      TaskTemplate,
      TaskElement
    ]),
    HttpModule,
    TemplateModule,
    ExecutionModule,
    AssignmentModule,
  ],
  providers: [
    TemplateExistsValidator,
    ElementsExistInTemplateValidator,
    AllElementsCompletedValidator
  ],
})
export class AppModule {}
