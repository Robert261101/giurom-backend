import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TemplateModule } from './template/template.module';
import { ExecutionModule } from './execution/execution.module';
import { AssignmentModule } from './assignment/assignment.module';
import { CronModule } from './cron/cron.module';
import { TaskTemplate } from './template/entity/task-template.entity';
import { TaskElement } from './template/entity/task-element.entity';
import { TemplateLocation } from './template/entity/template-location.entity';
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
      password: process.env.DB_PASSWORD || 'CosmiN18',
      database: process.env.DB_DATABASE || 'tasks',
      entities: [
        TaskTemplate,
        TaskElement,
        TemplateLocation,
        TaskExecution,
        TaskExecutionAnswer,
        EmployeeDailyPoints,
        EmployeeDailyTaskPoints,
        TaskAssignment,
        TaskAssignmentElement
      ],
      synchronize: false, // Temporar pentru a adăuga câmpurile noi
      // dropSchema: true, 
    }),
    TypeOrmModule.forFeature([
      TaskTemplate,
      TaskElement,
      TemplateLocation
    ]),
    HttpModule,
    ScheduleModule.forRoot(),
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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET') || 'your-secret-key';
        const expiresIn = configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '24h';
        console.log('🔍 [AppModule] JWT Secret configurat în veziv-tasks:', secret);
        console.log('🔍 [AppModule] JWT ExpiresIn configurat în veziv-tasks:', expiresIn);
        return {
          global: true,
          secret: secret,
          signOptions: { 
            expiresIn: expiresIn
          },
        };
      },
      inject: [ConfigService],
    }),
    TemplateModule,
    ExecutionModule,
    AssignmentModule,
    CronModule,
  ],
  providers: [
    TemplateExistsValidator,
    ElementsExistInTemplateValidator,
    AllElementsCompletedValidator
  ],
})
export class AppModule {}
