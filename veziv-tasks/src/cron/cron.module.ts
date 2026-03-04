import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { TaskAssignment } from '../assignment/entity/task-assignment.entity';
import { TaskExecution } from '../execution/entity/task-execution.entity';
import { TaskExecutionAnswer } from '../execution/entity/task-execution-answer.entity';
import { EmployeeDailyPoints } from '../execution/entity/employee-daily-points.entity';
import { EmployeeDailyTaskPoints } from '../execution/entity/employee-daily-task-points.entity';
import { ManagerDailyPayout } from '../execution/entity/manager-daily-payout.entity';
import { ExecutionModule } from '../execution/execution.module';
import { AssignmentModule } from '../assignment/assignment.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule,
    NotificationsModule,
    AssignmentModule,
    TypeOrmModule.forFeature([
      TaskAssignment,
      TaskExecution,
      TaskExecutionAnswer,
      EmployeeDailyPoints,
      EmployeeDailyTaskPoints,
      ManagerDailyPayout,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') || 'your-secret-key';
        const expiresIn =
          configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '24h';
        return {
          global: true,
          secret: secret,
          signOptions: {
            expiresIn: expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
    ExecutionModule,
  ],
  controllers: [CronController],
  providers: [CronService, InternalServiceGuard],
  exports: [CronService],
})
export class CronModule {}
